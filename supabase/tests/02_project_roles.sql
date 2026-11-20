-- pgTAP: project visibility and the project-role permission matrix.
begin;

select plan(13);

alter table public.profiles disable trigger profiles_protect;

insert into auth.users (id, email, raw_user_meta_data) values
  ('30000000-0000-0000-0000-000000000001', 'pj-owner@example.test', '{"name":"Project Owner"}'::jsonb),
  ('30000000-0000-0000-0000-000000000002', 'pj-lead@example.test', '{"name":"Project Lead"}'::jsonb),
  ('30000000-0000-0000-0000-000000000003', 'pj-contributor@example.test', '{"name":"Project Contributor"}'::jsonb),
  ('30000000-0000-0000-0000-000000000004', 'pj-viewer@example.test', '{"name":"Project Viewer"}'::jsonb),
  ('30000000-0000-0000-0000-000000000005', 'pj-outsider@example.test', '{"name":"Project Outsider"}'::jsonb),
  ('30000000-0000-0000-0000-000000000006', 'pj-target@example.test', '{"name":"Project Target"}'::jsonb),
  ('30000000-0000-0000-0000-000000000007', 'pj-client@example.test', '{"name":"Project Client"}'::jsonb)
on conflict (id) do nothing;

insert into public.profiles (id, email, name, role, disabled) values
  ('30000000-0000-0000-0000-000000000001', 'pj-owner@example.test', 'Project Owner', 'owner', false),
  ('30000000-0000-0000-0000-000000000002', 'pj-lead@example.test', 'Project Lead', 'manager', false),
  ('30000000-0000-0000-0000-000000000003', 'pj-contributor@example.test', 'Project Contributor', 'manager', false),
  ('30000000-0000-0000-0000-000000000004', 'pj-viewer@example.test', 'Project Viewer', 'viewer', false),
  ('30000000-0000-0000-0000-000000000005', 'pj-outsider@example.test', 'Project Outsider', 'manager', false),
  ('30000000-0000-0000-0000-000000000006', 'pj-target@example.test', 'Project Target', 'member', false),
  ('30000000-0000-0000-0000-000000000007', 'pj-client@example.test', 'Project Client', 'viewer', false)
on conflict (id) do update set role = excluded.role, disabled = false;

insert into public.projects (id, name, visibility, created_by) values
  ('30000000-0000-0000-0000-000000000010', 'Private Matrix Project', 'private', '30000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000011', 'Private Single Lead Project', 'private', '30000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.project_members (project_id, user_id, role) values
  ('30000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000002', 'lead'),
  ('30000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000003', 'contributor'),
  ('30000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000004', 'viewer'),
  ('30000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000007', 'client'),
  ('30000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000002', 'lead')
on conflict do nothing;

create or replace function pg_temp.as_user(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  execute 'set local role authenticated';
end;
$$;

-- Visibility ---------------------------------------------------------------
perform pg_temp.as_user('30000000-0000-0000-0000-000000000002');
select ok(public.can_view_project('30000000-0000-0000-0000-000000000010'), 'project lead views private project');
reset role;

perform pg_temp.as_user('30000000-0000-0000-0000-000000000004');
select ok(public.can_view_project('30000000-0000-0000-0000-000000000010'), 'project viewer views private project');
reset role;

perform pg_temp.as_user('30000000-0000-0000-0000-000000000005');
select ok(not public.can_view_project('30000000-0000-0000-0000-000000000010'), 'non-member manager cannot view private project');
reset role;

perform pg_temp.as_user('30000000-0000-0000-0000-000000000001');
select ok(public.can_view_project('30000000-0000-0000-0000-000000000010'), 'owner views private project');
reset role;

-- Scoped project writes ----------------------------------------------------
perform pg_temp.as_user('30000000-0000-0000-0000-000000000005');
select ok(not public.can_write_project('30000000-0000-0000-0000-000000000010'), 'non-member manager cannot write private project');
reset role;

perform pg_temp.as_user('30000000-0000-0000-0000-000000000003');
select ok(public.can_write_project('30000000-0000-0000-0000-000000000010'), 'contributor manager can write their project');
reset role;

-- Membership matrix --------------------------------------------------------
perform pg_temp.as_user('30000000-0000-0000-0000-000000000002');
select lives_ok(
  $$select public.add_project_member('30000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000006', 'viewer'::public.project_role)$$,
  'project lead can add a viewer'
);
reset role;

perform pg_temp.as_user('30000000-0000-0000-0000-000000000003');
select throws_ok(
  $$select public.add_project_member('30000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000006', 'viewer'::public.project_role)$$,
  null, null,
  'project contributor cannot add members'
);
reset role;

perform pg_temp.as_user('30000000-0000-0000-0000-000000000004');
select throws_ok(
  $$select public.add_project_member('30000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000006', 'viewer'::public.project_role)$$,
  null, null,
  'project viewer cannot add members'
);
reset role;

perform pg_temp.as_user('30000000-0000-0000-0000-000000000007');
select throws_ok(
  $$select public.add_project_member('30000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000006', 'viewer'::public.project_role)$$,
  null, null,
  'project client cannot add members'
);
reset role;

perform pg_temp.as_user('30000000-0000-0000-0000-000000000002');
select lives_ok(
  $$select public.set_project_member_role('30000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000006', 'lead'::public.project_role)$$,
  'project lead can assign a role at or below lead'
);
reset role;

perform pg_temp.as_user('30000000-0000-0000-0000-000000000002');
select throws_ok(
  $$select public.remove_project_member('30000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000002')$$,
  null, null,
  'last project lead cannot be removed'
);
reset role;

perform pg_temp.as_user('30000000-0000-0000-0000-000000000001');
select lives_ok(
  $$select public.remove_project_member('30000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000006')$$,
  'owner can remove a project member'
);
reset role;

select finish();
rollback;
