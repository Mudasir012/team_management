-- pgTAP: every workspace role against every table.
-- Run with: supabase db test (or paste into a pgTAP-enabled SQL Editor).
begin;

select plan(150);

-- Keep the fixture deterministic and isolated to this transaction.
alter table public.profiles disable trigger profiles_protect;

-- Auth identities. handle_new_user() creates the first profile; the explicit
-- upsert below normalises all five roles even on databases without that trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'role-owner@example.test', '{"name":"Role Owner"}'::jsonb),
  ('10000000-0000-0000-0000-000000000002', 'role-admin@example.test', '{"name":"Role Admin"}'::jsonb),
  ('10000000-0000-0000-0000-000000000003', 'role-manager@example.test', '{"name":"Role Manager"}'::jsonb),
  ('10000000-0000-0000-0000-000000000004', 'role-member@example.test', '{"name":"Role Member"}'::jsonb),
  ('10000000-0000-0000-0000-000000000005', 'role-viewer@example.test', '{"name":"Role Viewer"}'::jsonb)
on conflict (id) do nothing;

insert into public.profiles (id, email, name, role, disabled) values
  ('10000000-0000-0000-0000-000000000001', 'role-owner@example.test', 'Role Owner', 'owner', false),
  ('10000000-0000-0000-0000-000000000002', 'role-admin@example.test', 'Role Admin', 'admin', false),
  ('10000000-0000-0000-0000-000000000003', 'role-manager@example.test', 'Role Manager', 'manager', false),
  ('10000000-0000-0000-0000-000000000004', 'role-member@example.test', 'Role Member', 'member', false),
  ('10000000-0000-0000-0000-000000000005', 'role-viewer@example.test', 'Role Viewer', 'viewer', false)
on conflict (id) do update set role = excluded.role, disabled = false;

-- Core fixtures.
insert into public.labels (id, name) values
  ('20000000-0000-0000-0000-000000000001', 'Role Test Label')
on conflict (id) do nothing;

insert into public.customers (id, name) values
  ('20000000-0000-0000-0000-000000000002', 'Role Test Customer')
on conflict (id) do nothing;

insert into public.projects (id, name, visibility, created_by) values
  ('20000000-0000-0000-0000-000000000010', 'Role Test Workspace Project', 'workspace', '10000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.project_members (project_id, user_id, role) values
  ('20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'lead'),
  ('20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000003', 'contributor'),
  ('20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000005', 'viewer')
on conflict do nothing;

insert into public.project_labels (project_id, label_id) values
  ('20000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000001')
on conflict do nothing;

insert into public.tasks (id, project_id, title, created_by) values
  ('20000000-0000-0000-0000-000000000020', '20000000-0000-0000-0000-000000000010', 'Role Test Task', '10000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.task_assignees (task_id, user_id) values
  ('20000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000001')
on conflict do nothing;

insert into public.task_labels (task_id, label_id) values
  ('20000000-0000-0000-0000-000000000020', '20000000-0000-0000-0000-000000000001')
on conflict do nothing;

insert into public.task_comments (id, task_id, project_id, author_id, body, notify_sent) values
  ('20000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000020', '20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'Fixture comment', true)
on conflict (id) do nothing;

insert into public.task_subtasks (id, task_id, title) values
  ('20000000-0000-0000-0000-000000000022', '20000000-0000-0000-0000-000000000020', 'Fixture subtask')
on conflict (id) do nothing;

insert into public.task_attachments (id, task_id, project_id, name) values
  ('20000000-0000-0000-0000-000000000023', '20000000-0000-0000-0000-000000000020', '20000000-0000-0000-0000-000000000010', 'fixture.txt')
on conflict (id) do nothing;

insert into public.milestones (id, project_id, title) values
  ('20000000-0000-0000-0000-000000000024', '20000000-0000-0000-0000-000000000010', 'Fixture milestone')
on conflict (id) do nothing;

insert into public.project_docs (id, project_id, title) values
  ('20000000-0000-0000-0000-000000000025', '20000000-0000-0000-0000-000000000010', 'Fixture doc')
on conflict (id) do nothing;

insert into public.project_files (id, project_id, name) values
  ('20000000-0000-0000-0000-000000000026', '20000000-0000-0000-0000-000000000010', 'fixture.txt')
on conflict (id) do nothing;

insert into public.chat_messages (id, project_id, author_id, text) values
  ('20000000-0000-0000-0000-000000000027', '20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'Fixture message')
on conflict (id) do nothing;

insert into public.activities (id, project_id, actor_id, text) values
  ('20000000-0000-0000-0000-000000000028', '20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'Fixture activity')
on conflict (id) do nothing;

insert into public.leads (id, company) values
  ('20000000-0000-0000-0000-000000000030', 'Role Test Lead')
on conflict (id) do nothing;

insert into public.invoices (id, client, amount) values
  ('ROLE-TEST-INV', 'Role Test Client', 100)
on conflict (id) do nothing;

insert into public.expenses (id, vendor, amount) values
  ('20000000-0000-0000-0000-000000000031', 'Role Test Vendor', 10)
on conflict (id) do nothing;

insert into public.goals (id, title) values
  ('20000000-0000-0000-0000-000000000032', 'Role Test Goal')
on conflict (id) do nothing;

insert into public.audit_log (id, user_id, action) values
  ('20000000-0000-0000-0000-000000000033', '10000000-0000-0000-0000-000000000001', 'fixture audit')
on conflict (id) do nothing;

insert into public.automations (id, name, trigger, action) values
  ('20000000-0000-0000-0000-000000000034', 'Role Test Automation', 'manual', 'noop')
on conflict (id) do nothing;

insert into public.workspace_settings (key, value) values
  ('role_test', '"fixture"'::jsonb)
on conflict (key) do nothing;

insert into public.workspace_invites (id, email, name, role, invited_by) values
  ('20000000-0000-0000-0000-000000000035', 'role-invite@example.test', 'Role Invite', 'member', '10000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.teams (id, name) values
  ('20000000-0000-0000-0000-000000000036', 'Role Test Team')
on conflict (id) do nothing;

insert into public.team_members (team_id, user_id) values
  ('20000000-0000-0000-0000-000000000036', '10000000-0000-0000-0000-000000000004')
on conflict do nothing;

-- User-owned rows: every role gets one so the visibility expectation is true.
insert into public.notifications (id, user_id, text)
select gen_random_uuid(), p.id, 'Fixture notification'
from public.profiles p
where p.id = any(array[
  '10000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000002'::uuid,
  '10000000-0000-0000-0000-000000000003'::uuid,
  '10000000-0000-0000-0000-000000000004'::uuid,
  '10000000-0000-0000-0000-000000000005'::uuid
]);

insert into public.saved_views (id, user_id, name)
select gen_random_uuid(), p.id, 'Fixture view'
from public.profiles p
where p.id = any(array[
  '10000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000002'::uuid,
  '10000000-0000-0000-0000-000000000003'::uuid,
  '10000000-0000-0000-0000-000000000004'::uuid,
  '10000000-0000-0000-0000-000000000005'::uuid
]);

insert into public.time_entries (id, user_id, hours)
select gen_random_uuid(), p.id, 1
from public.profiles p
where p.id = any(array[
  '10000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000002'::uuid,
  '10000000-0000-0000-0000-000000000003'::uuid,
  '10000000-0000-0000-0000-000000000004'::uuid,
  '10000000-0000-0000-0000-000000000005'::uuid
]);

create or replace function pg_temp.expected_visible(p_role text, p_table text)
returns boolean language sql immutable as $$
  select case
    when p_table in (
      'profiles','labels','projects','project_members','project_labels','tasks',
      'task_assignees','task_labels','task_comments','task_subtasks','task_attachments',
      'milestones','project_docs','project_files','chat_messages','activities',
      'workspace_settings','notifications','saved_views','time_entries'
    ) then true
    when p_table in ('customers','workspace_invites','teams','team_members','audit_log','automations')
      then p_role <> 'viewer'
    when p_table in ('leads','invoices','expenses','goals')
      then p_role in ('owner','admin','manager')
    else false
  end;
$$;

do $$
declare
  v_roles text[] := array['owner','admin','manager','member','viewer'];
  v_tables text[] := array[
    'profiles','workspace_invites','labels','customers','projects','project_members',
    'project_labels','tasks','task_assignees','task_labels','task_comments',
    'task_subtasks','task_attachments','milestones','project_docs','project_files',
    'chat_messages','activities','leads','invoices','expenses','goals','notifications',
    'audit_log','saved_views','automations','workspace_settings','time_entries',
    'teams','team_members'
  ];
  v_role text;
  v_table text;
  v_user_id uuid;
  v_visible boolean;
begin
  foreach v_role in array v_roles loop
    select id into v_user_id
    from public.profiles
    where role = v_role and email like 'role-%@example.test'
    limit 1;

    foreach v_table in array v_tables loop
      perform set_config('request.jwt.claim.sub', v_user_id::text, true);
      execute 'set local role authenticated';
      execute format('select count(*) > 0 from public.%I', v_table) into v_visible;
      reset role;

      perform ok(
        v_visible = pg_temp.expected_visible(v_role, v_table),
        format('%s sees %s: expected %s, got %s', v_role, v_table,
               pg_temp.expected_visible(v_role, v_table), v_visible)
      );
    end loop;
  end loop;
end $$;

select finish();
rollback;
