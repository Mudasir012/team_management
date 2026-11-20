-- pgTAP: conflict-checked task upsert, normalized children and assignment rules.
begin;

select plan(7);

alter table public.profiles disable trigger profiles_protect;

insert into auth.users (id, email, raw_user_meta_data) values
  ('40000000-0000-0000-0000-000000000001', 'task-owner@example.test', '{"name":"Task Owner"}'::jsonb),
  ('40000000-0000-0000-0000-000000000002', 'task-contributor@example.test', '{"name":"Task Contributor"}'::jsonb),
  ('40000000-0000-0000-0000-000000000003', 'task-outsider@example.test', '{"name":"Task Outsider"}'::jsonb)
on conflict (id) do nothing;

insert into public.profiles (id, email, name, role, disabled) values
  ('40000000-0000-0000-0000-000000000001', 'task-owner@example.test', 'Task Owner', 'manager', false),
  ('40000000-0000-0000-0000-000000000002', 'task-contributor@example.test', 'Task Contributor', 'manager', false),
  ('40000000-0000-0000-0000-000000000003', 'task-outsider@example.test', 'Task Outsider', 'viewer', false)
on conflict (id) do update set role = excluded.role, disabled = false;

insert into public.projects (id, name, visibility, created_by) values
  ('40000000-0000-0000-0000-000000000010', 'Task Upsert Project', 'workspace', '40000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.project_members (project_id, user_id, role) values
  ('40000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000001', 'lead'),
  ('40000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000002', 'contributor')
on conflict do nothing;

insert into public.tasks (id, project_id, title, created_by) values
  ('40000000-0000-0000-0000-000000000020', '40000000-0000-0000-0000-000000000010', 'Task Upsert Fixture', '40000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.task_assignees (task_id, user_id) values
  ('40000000-0000-0000-0000-000000000020', '40000000-0000-0000-0000-000000000001')
on conflict do nothing;

create or replace function pg_temp.as_user(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  execute 'set local role authenticated';
end;
$$;

do $$
declare
  c_task uuid := '40000000-0000-0000-0000-000000000020'::uuid;
  c_project uuid := '40000000-0000-0000-0000-000000000010'::uuid;
  v_expected timestamptz;
  v_fresh timestamptz;
  v_result jsonb;
  v_payload jsonb;
  v_legacy_empty boolean;
  v_notified boolean;
  v_comments integer;
  v_subtasks integer;
  v_attachments integer;
begin
  select updated_at into v_expected from public.tasks where id = c_task;

  v_payload := jsonb_build_object(
    'id', c_task,
    'projectId', c_project,
    'title', 'Task Upsert Fixture',
    'description', 'Updated by RPC',
    'status', 'In Progress',
    'priority', 'High',
    'due', null,
    'recurring', null,
    'estimate', 2,
    'spent', 0,
    'checklist', '[]'::jsonb,
    'dependencies', '[]'::jsonb,
    'labels', '[]'::jsonb,
    'assignees', jsonb_build_array('40000000-0000-0000-0000-000000000001'),
    'subtasks', jsonb_build_array(jsonb_build_object('id', '50000000-0000-0000-0000-000000000001', 'title', 'Normalized subtask', 'done', false)),
    'attachments', jsonb_build_array(jsonb_build_object('id', '50000000-0000-0000-0000-000000000002', 'name', 'normalized.txt', 'size', '1 KB', 'type', 'text/plain')),
    'comments', jsonb_build_array(jsonb_build_object(
      'id', '50000000-0000-0000-0000-000000000003',
      'author', '40000000-0000-0000-0000-000000000002',
      'text', 'Normalized comment',
      'reactions', '{}'::jsonb
    ))
  );

  perform pg_temp.as_user('40000000-0000-0000-0000-000000000002');
  select public.upsert_task_checked(v_payload, v_expected) into v_result;
  reset role;

  select count(*) into v_comments from public.task_comments where task_id = c_task;
  select count(*) into v_subtasks from public.task_subtasks where task_id = c_task;
  select count(*) into v_attachments from public.task_attachments where task_id = c_task;

  perform ok(v_comments = 1 and jsonb_array_length(v_result->'comments') = 1,
             'comment is written to and read from task_comments');
  perform ok(v_subtasks = 1 and jsonb_array_length(v_result->'subtasks') = 1,
             'subtask is written to and read from task_subtasks');
  perform ok(v_attachments = 1 and jsonb_array_length(v_result->'attachments') = 1,
             'attachment is written to and read from task_attachments');

  select
    t.subtasks = '[]'::jsonb and t.attachments = '[]'::jsonb and t.comments = '[]'::jsonb,
    t.updated_at
  into v_legacy_empty, v_fresh
  from public.tasks t where t.id = c_task;
  perform ok(v_legacy_empty, 'legacy JSONB child columns are cleared');

  select exists (
    select 1 from public.notifications
    where user_id = '40000000-0000-0000-0000-000000000001'
      and text like '%commented on%'
  ) into v_notified;
  perform ok(v_notified, 'new comment notifies the task creator');

  perform pg_temp.as_user('40000000-0000-0000-0000-000000000002');
  perform throws_ok(
    format('select public.upsert_task_checked(%L, %L::timestamptz)', v_payload::text, (v_fresh - interval '1 hour')::text),
    '40001', null,
    'stale updated_at is rejected with a serialization error'
  );
  reset role;

  perform pg_temp.as_user('40000000-0000-0000-0000-000000000001');
  perform throws_ok(
    format(
      'select public.upsert_task_checked(%L, null::timestamptz)',
      jsonb_set(v_payload, '{assignees}', jsonb_build_array(
        '40000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000003'
      ))::text
    ),
    null, null,
    'non-project-member cannot be assigned to a task'
  );
  reset role;
end $$;

select finish();
rollback;
