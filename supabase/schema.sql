-- Acme Studio workspace schema for Supabase
-- Run this once in Supabase Dashboard -> SQL Editor.
-- It creates the role system, tables, row-level security, and workspace loader.
-- No demo/mock rows are inserted.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums (idempotent: create type has no IF NOT EXISTS)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.project_role as enum ('lead', 'contributor', 'viewer', 'client');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_visibility as enum ('workspace', 'private');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Role permissions (mirrors frontend/src/auth.jsx)
-- ---------------------------------------------------------------------------
create or replace function public.permissions_for(p_role text)
returns text[]
language sql
immutable
as $$
  select case p_role
    when 'owner' then array['*']::text[]
    when 'admin' then array[
      'projects:read','projects:write','projects:delete',
      'tasks:read','tasks:write','tasks:delete',
      'customers:read','customers:write','customers:delete',
      'leads:read','leads:write','leads:delete',
      'invoices:read','invoices:write',
      'expenses:read','expenses:write',
      'analytics:read','team:read','team:write','settings:write','ai:use','notifications:read'
    ]::text[]
    when 'manager' then array[
      'projects:read','projects:write',
      'tasks:read','tasks:write','tasks:delete',
      'customers:read','customers:write',
      'leads:read','leads:write',
      'invoices:read','expenses:read','expenses:write',
      'analytics:read','team:read','ai:use','notifications:read'
    ]::text[]
    when 'member' then array[
      'projects:read','tasks:read','tasks:write',
      'customers:read','team:read','ai:use','notifications:read'
    ]::text[]
    when 'viewer' then array['projects:read','tasks:read','ai:use','notifications:read']::text[]
    else array[]::text[]
  end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null,
  role text not null default 'viewer' check (role in ('owner','admin','manager','member','viewer')),
  title text not null default '',
  avatar text,
  color text not null default '#71717a',
  status text not null default 'offline' check (status in ('online','away','offline')),
  capacity integer not null default 32,
  hours numeric(7,2) not null default 0,
  leave integer,
  notification_prefs jsonb not null default '{"inApp":true,"email":true,"push":false,"mentions":true,"deadlines":true}'::jsonb,
  disabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_email_key on public.profiles (lower(email));

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null default '',
  title text not null default '',
  role text not null default 'member' check (role in ('admin','manager','member','viewer')),
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#6366f1',
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null default '',
  email text not null default '',
  status text not null default 'Active',
  value numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'To Do',
  start_date date,
  end_date date,
  budget numeric(12,2) not null default 0,
  customer_id uuid references public.customers(id) on delete set null,
  progress integer not null default 0 check (progress between 0 and 100),
  description text not null default '',
  sprint text not null default 'Backlog',
  preview text not null default 'stats',
  custom_fields jsonb not null default '{}'::jsonb,
  custom_statuses text[] not null default array['Backlog','Todo','In Progress','Review','Done'],
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (project_id, user_id)
);

create table if not exists public.project_labels (
  project_id uuid not null references public.projects(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (project_id, label_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text not null default '',
  status text not null default 'todo',
  priority text not null default 'Medium',
  due_date date,
  recurring text,
  estimate numeric(7,2),
  spent numeric(7,2) not null default 0,
  subtasks jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  comments jsonb not null default '[]'::jsonb,
  dependencies uuid[] not null default '{}'::uuid[],
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (task_id, user_id)
);

create table if not exists public.task_labels (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (task_id, label_id)
);

-- Normalized task collaboration data. The legacy JSONB columns on tasks are
-- retained for rollback safety but are no longer written to.
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  reactions jsonb not null default '{}'::jsonb,
  notify_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  size text not null default '',
  type text not null default '',
  url text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists task_comments_task_id_idx on public.task_comments (task_id);
create index if not exists task_subtasks_task_id_idx on public.task_subtasks (task_id);
create index if not exists task_attachments_task_id_idx on public.task_attachments (task_id);

-- One-time backfill from the legacy JSONB arrays. Deterministic UUIDs keep this
-- safe to re-run; on conflict do nothing also avoids duplicating live rows.
insert into public.task_comments (
  id, task_id, project_id, author_id, body, reactions, notify_sent, created_at, updated_at
)
select
  case
    when c.item->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (c.item->>'id')::uuid
    else md5(t.id::text || ':comment:' || c.ord::text)::uuid
  end,
  t.id,
  t.project_id,
  case
    when c.item->>'author' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and exists (select 1 from public.profiles p where p.id = (c.item->>'author')::uuid)
      then (c.item->>'author')::uuid
    else null
  end,
  coalesce(c.item->>'text', ''),
  coalesce(c.item->'reactions', '{}'::jsonb),
  true,
  t.created_at + (c.ord || ' seconds')::interval,
  t.created_at + (c.ord || ' seconds')::interval
from public.tasks t
cross join lateral jsonb_array_elements(coalesce(t.comments, '[]'::jsonb)) with ordinality as c(item, ord)
where jsonb_typeof(coalesce(t.comments, '[]'::jsonb)) = 'array'
on conflict (id) do nothing;

insert into public.task_subtasks (id, task_id, title, done, position)
select
  case
    when s.item->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (s.item->>'id')::uuid
    else md5(t.id::text || ':subtask:' || s.ord::text)::uuid
  end,
  t.id,
  coalesce(s.item->>'title', ''),
  coalesce((s.item->>'done')::boolean, false),
  s.ord::integer
from public.tasks t
cross join lateral jsonb_array_elements(coalesce(t.subtasks, '[]'::jsonb)) with ordinality as s(item, ord)
where jsonb_typeof(coalesce(t.subtasks, '[]'::jsonb)) = 'array'
on conflict (id) do nothing;

insert into public.task_attachments (
  id, task_id, project_id, name, size, type, url, uploaded_by
)
select
  case
    when a.item->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (a.item->>'id')::uuid
    else md5(t.id::text || ':attachment:' || a.ord::text)::uuid
  end,
  t.id,
  t.project_id,
  coalesce(a.item->>'name', ''),
  coalesce(a.item->>'size', ''),
  coalesce(a.item->>'type', ''),
  nullif(a.item->>'url', ''),
  null
from public.tasks t
cross join lateral jsonb_array_elements(coalesce(t.attachments, '[]'::jsonb)) with ordinality as a(item, ord)
where jsonb_typeof(coalesce(t.attachments, '[]'::jsonb)) = 'array'
on conflict (id) do nothing;

-- Task assignees must already be project members. OWNER/ADMIN are not exempt:
-- a project membership is the explicit opt-in that makes assignment coherent.
create or replace function public.trg_task_assignee_member_check()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project uuid;
begin
  select project_id into v_project from public.tasks where id = NEW.task_id;
  if v_project is null then
    raise exception 'Task not found';
  end if;
  if not exists (
    select 1 from public.project_members
    where project_id = v_project and user_id = NEW.user_id
  ) then
    raise exception 'Only project members can be assigned to tasks';
  end if;
  return NEW;
end;
$$;

drop trigger if exists task_assignees_member_check on public.task_assignees;
create trigger task_assignees_member_check
before insert or update of task_id, user_id on public.task_assignees
for each row execute function public.trg_task_assignee_member_check();

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  date date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.project_docs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null default 'Untitled',
  body text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  size text not null default '',
  type text not null default '',
  url text,
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  contact text not null default '',
  value numeric(12,2) not null default 0,
  stage text not null default 'New',
  owner_id uuid references public.profiles(id) on delete set null,
  source text not null default 'Inbound',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id text primary key,
  client text not null default '',
  project_id uuid references public.projects(id) on delete set null,
  amount numeric(12,2) not null default 0,
  status text not null default 'Draft',
  issued date not null default current_date,
  due date,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  category text not null default 'General',
  vendor text not null default '',
  amount numeric(12,2) not null default 0,
  date date not null default current_date,
  receipt text,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  progress integer not null default 0 check (progress between 0 and 100),
  owner_id uuid references public.profiles(id) on delete set null,
  quarter text not null default 'Q1',
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  project_id uuid references public.projects(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger text not null,
  condition text not null default '',
  action text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Teams group workspace members so a project can be shared with a whole team
-- through a single add_team_to_project() call.
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (team_id, user_id)
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  task text not null default '',
  hours numeric(7,2) not null default 0,
  date date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Membership / visibility extensions to existing tables (idempotent)
-- ---------------------------------------------------------------------------
alter table public.project_members
  add column if not exists role public.project_role not null default 'contributor',
  add column if not exists added_by uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

alter table public.projects
  add column if not exists visibility public.project_visibility not null default 'workspace';

alter table public.workspace_invites
  add column if not exists project_ids uuid[] not null default '{}'::uuid[],
  add column if not exists project_role public.project_role not null default 'contributor',
  add column if not exists expires_at timestamptz;

-- ---------------------------------------------------------------------------
-- Permission helpers (security definer prevents RLS recursion)
-- ---------------------------------------------------------------------------
create or replace function public.workspace_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    exists (select 1 from public.profiles p where p.id = auth.uid() and not p.disabled)
    and (
      '*' = any(public.permissions_for(public.workspace_role()))
      or p_permission = any(public.permissions_for(public.workspace_role()))
    ),
    false
  );
$$;

create or replace function public.is_project_member(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project and user_id = auth.uid()
  );
$$;

create or replace function public.can_view_project(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_permission('projects:read')
    and (
      public.workspace_role() in ('owner', 'admin')
      or coalesce(
        (select p.visibility from public.projects p where p.id = p_project),
        'workspace'::public.project_visibility
      ) = 'workspace'
      or public.is_project_member(p_project)
    );
$$;

create or replace function public.can_view_task(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task and public.can_view_project(t.project_id)
  );
$$;

-- Project role ordering: lead (3) > contributor (2) > viewer (1) > client (0).
create or replace function public.project_role_rank(p_role public.project_role)
returns integer
language sql
immutable
as $$
  select case p_role
    when 'lead' then 3
    when 'contributor' then 2
    when 'viewer' then 1
    when 'client' then 0
    else -1
  end;
$$;

-- Owners/admins always manage membership. A project lead can manage members,
-- but can only assign roles at or below their own (see can_assign_project_role).
create or replace function public.can_manage_project_members(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_permission('team:read') and (
    public.workspace_role() in ('owner', 'admin')
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = p_project and pm.user_id = auth.uid() and pm.role = 'lead'
    )
  );
$$;

create or replace function public.can_assign_project_role(
  p_project uuid,
  p_role public.project_role
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.workspace_role() in ('owner', 'admin')
    or (
      public.can_manage_project_members(p_project)
      and public.project_role_rank(p_role) <= public.project_role_rank('lead'::public.project_role)
    );
$$;

-- Managers can write only projects they actually belong to as lead/contributor.
create or replace function public.can_write_project(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_permission('projects:write')
    and (
      public.workspace_role() in ('owner', 'admin')
      or exists (
        select 1 from public.project_members pm
        where
          pm.project_id = p_project
          and pm.user_id = auth.uid()
          and pm.role in ('lead', 'contributor')
      )
    );
$$;

create or replace function public.can_create_task(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_permission('tasks:write')
    and (
      public.workspace_role() in ('owner', 'admin')
      or public.can_write_project(p_project)
      or exists (
        select 1 from public.project_members pm
        where
          pm.project_id = p_project
          and pm.user_id = auth.uid()
          and pm.role in ('lead', 'contributor')
      )
    );
$$;

-- Members may edit tasks they are assigned to, created, or in a project where
-- they are a lead/contributor. Managers are additionally project-scoped above.
create or replace function public.can_write_task(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_permission('tasks:write')
    and (
      public.workspace_role() in ('owner', 'admin')
      or public.can_write_project((select t.project_id from public.tasks t where t.id = p_task))
      or exists (
        select 1 from public.task_assignees ta
        where ta.task_id = p_task and ta.user_id = auth.uid()
      )
      or exists (
        select 1 from public.tasks t
        where t.id = p_task and t.created_by = auth.uid()
      )
      or exists (
        select 1 from public.tasks t
        join public.project_members pm on pm.project_id = t.project_id
        where
          t.id = p_task
          and pm.user_id = auth.uid()
          and pm.role in ('lead', 'contributor')
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- Profile creation + protection
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_name text;
  v_title text := '';
  v_invite public.workspace_invites%rowtype;
  v_first boolean;
  v_avatar text;
  v_project_id uuid;
begin
  select count(*) = 0 into v_first from public.profiles;
  v_name := coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(coalesce(new.email, ''), '@', 1));

  if v_first then
    v_role := 'owner';
    v_title := 'Owner';
  else
    select * into v_invite
    from public.workspace_invites
    where
      email = lower(coalesce(new.email, ''))
      and accepted_at is null
      and (expires_at is null or expires_at > now())
    order by created_at desc
    limit 1;

    if found then
      v_role := v_invite.role;
      v_title := v_invite.title;
      v_name := coalesce(nullif(v_invite.name, ''), v_name);
      update public.workspace_invites set accepted_at = now() where id = v_invite.id;
    else
      -- Uninvited sign-ups cannot grant themselves any privileged role.
      -- Their requested role is recorded in auth metadata, but access stays viewer
      -- until an owner or admin invites their email or changes their role.
      v_role := 'viewer';
    end if;
  end if;

  v_avatar := upper(
    left(split_part(v_name, ' ', 1), 1) || coalesce(left(split_part(v_name, ' ', 2), 1), '')
  );

  insert into public.profiles (id, name, email, role, title, avatar)
  values (new.id, v_name, lower(coalesce(new.email, '')), v_role, v_title, v_avatar);

  -- Apply any project memberships that came with the accepted invite.
  if v_invite.id is not null then
    foreach v_project_id in array coalesce(v_invite.project_ids, '{}'::uuid[]) loop
      insert into public.project_members (project_id, user_id, role, added_by)
      values (v_project_id, new.id, v_invite.project_role, v_invite.invited_by)
      on conflict (project_id, user_id) do nothing;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.protect_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role then
    if new.id = auth.uid() then
      raise exception 'You cannot change your own role';
    end if;
    if old.role = 'owner' then
      raise exception 'The owner role cannot be changed';
    end if;
    if not public.has_permission('team:write') then
      raise exception 'Only owners and admins can change roles';
    end if;
  end if;

  if new.disabled is distinct from old.disabled and not public.has_permission('team:write') then
    raise exception 'You cannot change access for this member';
  end if;

  new.email := old.email;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect
before update on public.profiles
for each row execute function public.protect_profile();

-- Keep updated_at current on the main editable tables.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
for each row execute function public.touch_updated_at();

drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks
for each row execute function public.touch_updated_at();

drop trigger if exists leads_touch on public.leads;
create trigger leads_touch before update on public.leads
for each row execute function public.touch_updated_at();

drop trigger if exists docs_touch on public.project_docs;
create trigger docs_touch before update on public.project_docs
for each row execute function public.touch_updated_at();

drop trigger if exists task_comments_touch on public.task_comments;
create trigger task_comments_touch before update on public.task_comments
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Workspace status + audit + team RPCs
-- ---------------------------------------------------------------------------
create or replace function public.workspace_status()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'needsSetup', (select count(*) = 0 from public.profiles),
    'signupOpen', true
  );
$$;

create or replace function public.log_audit(p_action text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.audit_log (user_id, action) values (auth.uid(), p_action);
$$;

-- ---------------------------------------------------------------------------
-- Notification triggers
-- ---------------------------------------------------------------------------
create or replace function public.notify_user(p_user uuid, p_text text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user is null or p_user = auth.uid() then return; end if;
  if exists (select 1 from public.profiles where id = p_user and not disabled) then
    insert into public.notifications (user_id, text) values (p_user, p_text);
  end if;
end;
$$;

create or replace function public.trg_project_member_notify()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project_name text;
  v_project_id uuid;
begin
  if TG_OP = 'INSERT' then
    v_project_id := NEW.project_id;
  else
    v_project_id := OLD.project_id;
  end if;

  select name into v_project_name
  from public.projects
  where id = v_project_id;

  if TG_OP = 'INSERT' then
    perform public.notify_user(
      NEW.user_id,
      'You were added to ' || coalesce(v_project_name, 'a project') || ' as ' || NEW.role
    );
  elsif TG_OP = 'UPDATE' and NEW.role is distinct from OLD.role then
    perform public.notify_user(
      NEW.user_id,
      'Your role in ' || coalesce(v_project_name, 'a project') || ' changed to ' || NEW.role
    );
  end if;
  return null;
end;
$$;

drop trigger if exists project_members_notify on public.project_members;
create trigger project_members_notify
after insert or update of role on public.project_members
for each row execute function public.trg_project_member_notify();

create or replace function public.trg_task_assigned_notify()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text;
  v_project_name text;
begin
  select t.title, p.name into v_title, v_project_name
  from public.tasks t
  join public.projects p on p.id = t.project_id
  where t.id = NEW.task_id;

  perform public.notify_user(
    NEW.user_id,
    'You were assigned to ' || coalesce(v_title, 'a task') ||
    case when v_project_name is null then '' else ' in ' || v_project_name end
  );
  return null;
end;
$$;

drop trigger if exists task_assignees_notify on public.task_assignees;
create trigger task_assignees_notify
after insert on public.task_assignees
for each row execute function public.trg_task_assigned_notify();

-- Task comments live in task_comments (created earlier in this script). This
-- AFTER INSERT trigger notifies the task creator, assignees, and any
-- @mentioned profile once. INSERT ... ON CONFLICT DO UPDATE does not fire
-- AFTER INSERT for updated rows, so sync rewrites never repeat notifications.
create or replace function public.trg_task_comment_notify()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text;
  v_author_name text;
  v_recipient uuid;
begin
  if NEW.notify_sent then return null; end if;

  select title into v_title from public.tasks where id = NEW.task_id;
  select coalesce(name, 'Someone') into v_author_name
  from public.profiles where id = NEW.author_id;
  v_author_name := coalesce(v_author_name, 'Someone');

  for v_recipient in
    select distinct p.id
    from public.profiles p
    where
      p.id <> coalesce(NEW.author_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and not p.disabled
      and (
        p.id = (select created_by from public.tasks where id = NEW.task_id)
        or exists (
          select 1 from public.task_assignees ta
          where ta.task_id = NEW.task_id and ta.user_id = p.id
        )
        or NEW.body ~* ('@' || p.id::text)
        or (coalesce(p.name, '') <> '' and lower(NEW.body) like '%@' || lower(p.name) || '%')
        or (coalesce(p.name, '') <> '' and lower(NEW.body) like '%@' || lower(split_part(p.name, ' ', 1)) || '%')
      )
  loop
    perform public.notify_user(
      v_recipient,
      v_author_name || ' commented on ' || coalesce(v_title, 'a task')
    );
  end loop;
  update public.task_comments set notify_sent = true where id = NEW.id;
  return null;
end;
$$;

drop trigger if exists task_comments_notify on public.task_comments;
create trigger task_comments_notify after insert on public.task_comments
for each row execute function public.trg_task_comment_notify();

create or replace function public.trg_workspace_role_notify()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if NEW.role is distinct from OLD.role then
    perform public.notify_user(NEW.id, 'Your workspace role changed to ' || NEW.role);
  end if;
  return null;
end;
$$;

drop trigger if exists profiles_role_notify on public.profiles;
create trigger profiles_role_notify
after update of role on public.profiles
for each row execute function public.trg_workspace_role_notify();

-- The old four-argument signature is replaced by the extended one below. New
-- callers can still pass just email/name/role/title thanks to the defaults.
drop function if exists public.invite_member(text, text, text, text);

create or replace function public.invite_member(
  p_email text,
  p_name text default '',
  p_role text default 'member',
  p_title text default '',
  p_project_ids uuid[] default '{}'::uuid[],
  p_project_role public.project_role default 'contributor',
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(p_email));
  v_role text := coalesce(nullif(trim(p_role), ''), 'member');
  v_existing public.profiles%rowtype;
  v_project_id uuid;
begin
  if not public.has_permission('team:write') then
    raise exception 'Only owners and admins can invite teammates';
  end if;
  if v_email = '' then
    raise exception 'Email is required';
  end if;
  if v_role not in ('admin', 'manager', 'member', 'viewer') then
    raise exception 'Choose a valid role';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'Invite expiry must be in the future';
  end if;

  -- Caller must be allowed to add people to every requested project.
  foreach v_project_id in array coalesce(p_project_ids, '{}'::uuid[]) loop
    if not public.can_manage_project_members(v_project_id)
       or not public.can_assign_project_role(v_project_id, p_project_role) then
      raise exception 'You cannot add people to one of these projects';
    end if;
  end loop;

  select * into v_existing from public.profiles where email = v_email;
  if found then
    if v_existing.disabled then
      update public.profiles
      set disabled = false,
          role = v_role,
          name = coalesce(nullif(p_name, ''), v_existing.name),
          title = p_title
      where id = v_existing.id;
      foreach v_project_id in array coalesce(p_project_ids, '{}'::uuid[]) loop
        insert into public.project_members (project_id, user_id, role, added_by)
        values (v_project_id, v_existing.id, p_project_role, auth.uid())
        on conflict (project_id, user_id)
        do update set role = excluded.role, added_by = excluded.added_by;
      end loop;
      perform public.log_audit('re-activated ' || v_existing.email);
      return jsonb_build_object('email', v_existing.email, 'role', v_role, 'reactivated', true);
    end if;
    raise exception 'That email already has an account';
  end if;

  insert into public.workspace_invites (email, name, title, role, invited_by, project_ids, project_role, expires_at)
  values (
    v_email, coalesce(p_name, ''), coalesce(p_title, ''), v_role, auth.uid(),
    coalesce(p_project_ids, '{}'::uuid[]), p_project_role, p_expires_at
  )
  on conflict (email) do update
    set name = excluded.name,
        title = excluded.title,
        role = excluded.role,
        invited_by = excluded.invited_by,
        project_ids = excluded.project_ids,
        project_role = excluded.project_role,
        expires_at = excluded.expires_at,
        accepted_at = null;

  perform public.log_audit('invited ' || v_email || ' as ' || v_role);
  return jsonb_build_object('email', v_email, 'role', v_role, 'reactivated', false);
end;
$$;

create or replace function public.set_member_role(p_member uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target public.profiles%rowtype;
begin
  if not public.has_permission('team:write') then
    raise exception 'Only owners and admins can change roles';
  end if;
  if p_member = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;
  if p_role not in ('admin', 'manager', 'member', 'viewer') then
    raise exception 'Choose a valid role';
  end if;

  select * into v_target from public.profiles where id = p_member;
  if not found then raise exception 'Member not found'; end if;
  if v_target.role = 'owner' then raise exception 'The owner role cannot be changed'; end if;

  update public.profiles set role = p_role where id = p_member;
  perform public.log_audit('changed role for ' || v_target.name || ' to ' || p_role);
  return jsonb_build_object('id', p_member, 'role', p_role);
end;
$$;

create or replace function public.remove_member(p_member uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target public.profiles%rowtype;
begin
  if public.workspace_role() is distinct from 'owner' then
    raise exception 'Only the owner can remove members';
  end if;
  if p_member = auth.uid() then
    raise exception 'You cannot remove yourself';
  end if;

  select * into v_target from public.profiles where id = p_member;
  if not found then raise exception 'Member not found'; end if;
  if v_target.role = 'owner' then raise exception 'The owner cannot be removed'; end if;

  update public.profiles
  set disabled = true, role = 'viewer', status = 'offline'
  where id = p_member;

  delete from public.project_members where user_id = p_member;
  delete from public.team_members where user_id = p_member;
  delete from public.task_assignees where user_id = p_member;
  perform public.log_audit('removed ' || v_target.name);
  return jsonb_build_object('id', p_member, 'removed', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Project membership + team RPCs (SECURITY DEFINER, audit logged)
-- ---------------------------------------------------------------------------
create or replace function public.add_project_member(
  p_project uuid,
  p_user uuid,
  p_role public.project_role default 'contributor'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project_name text;
  v_user_name text;
begin
  if not public.can_manage_project_members(p_project)
     or not public.can_assign_project_role(p_project, p_role) then
    raise exception 'You cannot add people with that project role';
  end if;

  select name into v_project_name from public.projects where id = p_project;
  if not found then raise exception 'Project not found'; end if;
  select name into v_user_name from public.profiles where id = p_user and not disabled;
  if not found then raise exception 'Member not found or access disabled'; end if;

  insert into public.project_members (project_id, user_id, role, added_by)
  values (p_project, p_user, p_role, auth.uid())
  on conflict (project_id, user_id)
  do update set role = excluded.role, added_by = excluded.added_by;

  perform public.log_audit('added ' || v_user_name || ' to ' || v_project_name || ' as ' || p_role);
  return jsonb_build_object('projectId', p_project, 'userId', p_user, 'role', p_role);
end;
$$;

create or replace function public.set_project_member_role(
  p_project uuid,
  p_user uuid,
  p_role public.project_role
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project_name text;
  v_user_name text;
begin
  if not public.can_manage_project_members(p_project)
     or not public.can_assign_project_role(p_project, p_role) then
    raise exception 'You cannot assign that project role';
  end if;

  select name into v_project_name from public.projects where id = p_project;
  if not found then raise exception 'Project not found'; end if;
  select name into v_user_name from public.profiles where id = p_user and not disabled;
  if not found then raise exception 'Member not found or access disabled'; end if;

  if not exists (
    select 1 from public.project_members where project_id = p_project and user_id = p_user
  ) then
    raise exception 'That person is not a member of this project';
  end if;

  update public.project_members
  set role = p_role
  where project_id = p_project and user_id = p_user;

  perform public.log_audit('changed ' || v_user_name || ' role in ' || v_project_name || ' to ' || p_role);
  return jsonb_build_object('projectId', p_project, 'userId', p_user, 'role', p_role);
end;
$$;

create or replace function public.remove_project_member(p_project uuid, p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project_name text;
  v_user_name text;
  v_role public.project_role;
  v_leads integer;
begin
  if not public.can_manage_project_members(p_project) then
    raise exception 'You cannot manage this project’s members';
  end if;

  select name into v_project_name from public.projects where id = p_project;
  if not found then raise exception 'Project not found'; end if;
  select name into v_user_name from public.profiles where id = p_user;
  if not found then raise exception 'Member not found'; end if;

  select role into v_role
  from public.project_members
  where project_id = p_project and user_id = p_user;
  if not found then raise exception 'That person is not a member of this project'; end if;

  if v_role = 'lead' then
    select count(*) into v_leads
    from public.project_members
    where project_id = p_project and role = 'lead';
    if v_leads <= 1 then
      raise exception 'A project must keep at least one lead';
    end if;
  end if;

  delete from public.project_members
  where project_id = p_project and user_id = p_user;

  -- Removing a project membership also drops task assignments in that project.
  delete from public.task_assignees ta
  using public.tasks t
  where ta.task_id = t.id and t.project_id = p_project and ta.user_id = p_user;

  perform public.log_audit('removed ' || v_user_name || ' from ' || v_project_name);
  return jsonb_build_object('projectId', p_project, 'userId', p_user, 'removed', true);
end;
$$;

create or replace function public.add_team_to_project(
  p_project uuid,
  p_team uuid,
  p_role public.project_role default 'contributor'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project_name text;
  v_team_name text;
  v_added integer;
begin
  if not public.can_manage_project_members(p_project)
     or not public.can_assign_project_role(p_project, p_role) then
    raise exception 'You cannot add that team with that project role';
  end if;

  select name into v_project_name from public.projects where id = p_project;
  if not found then raise exception 'Project not found'; end if;
  select name into v_team_name from public.teams where id = p_team;
  if not found then raise exception 'Team not found'; end if;

  insert into public.project_members (project_id, user_id, role, added_by)
  select p_project, tm.user_id, p_role, auth.uid()
  from public.team_members tm
  join public.profiles p on p.id = tm.user_id and not p.disabled
  on conflict (project_id, user_id)
  do update set role = excluded.role, added_by = excluded.added_by;
  get diagnostics v_added = row_count;

  perform public.log_audit('added team ' || v_team_name || ' to ' || v_project_name || ' as ' || p_role);
  return jsonb_build_object('projectId', p_project, 'teamId', p_team, 'role', p_role, 'added', v_added);
end;
$$;

-- ---------------------------------------------------------------------------
-- Conflict-checked task upsert
-- ---------------------------------------------------------------------------
create or replace function public.upsert_task_checked(
  p_task jsonb,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_task_id uuid := nullif(p_task->>'id', '')::uuid;
  v_project_id uuid := nullif(p_task->>'projectId', '')::uuid;
  v_existing public.tasks%rowtype;
  v_title text := coalesce(nullif(p_task->>'title', ''), 'Untitled');
  v_label_ids uuid[] := '{}'::uuid[];
  v_assignee_ids uuid[] := '{}'::uuid[];
  v_dependency_ids uuid[] := '{}'::uuid[];
  v_comment_ids uuid[] := '{}'::uuid[];
  v_subtask_ids uuid[] := '{}'::uuid[];
  v_attachment_ids uuid[] := '{}'::uuid[];
begin
  if v_project_id is null then
    raise exception 'A task must belong to a project';
  end if;
  if v_task_id is null then
    v_task_id := gen_random_uuid();
  end if;

  -- Desired IDs are computed before writes so unrelated child rows are not
  -- reinserted (which would re-fire assignment/comment notifications).
  select coalesce(array_agg(x.value::uuid), '{}'::uuid[])
  into v_label_ids
  from jsonb_array_elements_text(coalesce(p_task->'labels', '[]'::jsonb)) as x(value)
  where x.value ~* c_uuid;

  select coalesce(array_agg(x.value::uuid), '{}'::uuid[])
  into v_assignee_ids
  from jsonb_array_elements_text(coalesce(p_task->'assignees', '[]'::jsonb)) as x(value)
  where x.value ~* c_uuid;

  select coalesce(array_agg(x.value::uuid), '{}'::uuid[])
  into v_dependency_ids
  from jsonb_array_elements_text(coalesce(p_task->'dependencies', '[]'::jsonb)) as x(value)
  where x.value ~* c_uuid;

  select * into v_existing from public.tasks where id = v_task_id;

  if found then
    if not public.can_write_task(v_task_id) then
      raise exception 'You cannot edit this task';
    end if;
    if p_expected_updated_at is not null and v_existing.updated_at <> p_expected_updated_at then
      raise exception using
        errcode = '40001',
        message = 'This task changed on the server',
        detail = 'Reload before saving your changes.';
    end if;

    update public.tasks
    set
      title = v_title,
      description = coalesce(p_task->>'description', ''),
      status = coalesce(nullif(p_task->>'status', ''), status),
      priority = coalesce(nullif(p_task->>'priority', ''), priority),
      due_date = nullif(p_task->>'due', '')::date,
      recurring = nullif(p_task->>'recurring', ''),
      estimate = nullif(p_task->>'estimate', '')::numeric,
      spent = coalesce(nullif(p_task->>'spent', '')::numeric, 0),
      checklist = coalesce(p_task->'checklist', '[]'::jsonb),
      dependencies = v_dependency_ids,
      subtasks = '[]'::jsonb,
      attachments = '[]'::jsonb,
      comments = '[]'::jsonb
    where id = v_task_id;
  else
    if not public.can_create_task(v_project_id) then
      raise exception 'You cannot create tasks in this project';
    end if;

    insert into public.tasks (
      id, project_id, title, description, status, priority, due_date, recurring,
      estimate, spent, checklist, dependencies, subtasks, attachments, comments, created_by
    )
    values (
      v_task_id, v_project_id, v_title, coalesce(p_task->>'description', ''),
      coalesce(nullif(p_task->>'status', ''), 'todo'),
      coalesce(nullif(p_task->>'priority', ''), 'Medium'),
      nullif(p_task->>'due', '')::date,
      nullif(p_task->>'recurring', ''),
      nullif(p_task->>'estimate', '')::numeric,
      coalesce(nullif(p_task->>'spent', '')::numeric, 0),
      coalesce(p_task->'checklist', '[]'::jsonb),
      v_dependency_ids, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, auth.uid()
    );
  end if;

  -- IDs for the remaining children use deterministic fallbacks for legacy
  -- non-UUID ids so re-running the payload never creates duplicates.
  select coalesce(array_agg(
    case
      when c.item->>'id' ~* c_uuid then (c.item->>'id')::uuid
      else md5(v_task_id::text || ':comment:' || c.ord::text)::uuid
    end
  ), '{}'::uuid[])
  into v_comment_ids
  from jsonb_array_elements(coalesce(p_task->'comments', '[]'::jsonb)) with ordinality as c(item, ord);

  select coalesce(array_agg(
    case
      when s.item->>'id' ~* c_uuid then (s.item->>'id')::uuid
      else md5(v_task_id::text || ':subtask:' || s.ord::text)::uuid
    end
  ), '{}'::uuid[])
  into v_subtask_ids
  from jsonb_array_elements(coalesce(p_task->'subtasks', '[]'::jsonb)) with ordinality as s(item, ord);

  select coalesce(array_agg(
    case
      when a.item->>'id' ~* c_uuid then (a.item->>'id')::uuid
      else md5(v_task_id::text || ':attachment:' || a.ord::text)::uuid
    end
  ), '{}'::uuid[])
  into v_attachment_ids
  from jsonb_array_elements(coalesce(p_task->'attachments', '[]'::jsonb)) with ordinality as a(item, ord);

  delete from public.task_labels
  where task_id = v_task_id and not (label_id = any(v_label_ids));
  insert into public.task_labels (task_id, label_id)
  select v_task_id, x from unnest(v_label_ids) as x
  on conflict do nothing;

  delete from public.task_assignees
  where task_id = v_task_id and not (user_id = any(v_assignee_ids));
  insert into public.task_assignees (task_id, user_id)
  select v_task_id, x from unnest(v_assignee_ids) as x
  on conflict do nothing;

  delete from public.task_comments
  where task_id = v_task_id and not (id = any(v_comment_ids));
  insert into public.task_comments (
    id, task_id, project_id, author_id, body, reactions, notify_sent, created_at, updated_at
  )
  select
    case
      when c.item->>'id' ~* c_uuid then (c.item->>'id')::uuid
      else md5(v_task_id::text || ':comment:' || c.ord::text)::uuid
    end,
    v_task_id,
    v_project_id,
    case
      when c.item->>'author' ~* c_uuid
        and exists (select 1 from public.profiles p where p.id = (c.item->>'author')::uuid)
        then (c.item->>'author')::uuid
      else null
    end,
    coalesce(c.item->>'text', ''),
    coalesce(c.item->'reactions', '{}'::jsonb),
    false,
    now(),
    now()
  from jsonb_array_elements(coalesce(p_task->'comments', '[]'::jsonb)) with ordinality as c(item, ord)
  on conflict (id) do update
    set body = excluded.body,
        reactions = excluded.reactions,
        updated_at = now();

  delete from public.task_subtasks
  where task_id = v_task_id and not (id = any(v_subtask_ids));
  insert into public.task_subtasks (id, task_id, title, done, position)
  select
    case
      when s.item->>'id' ~* c_uuid then (s.item->>'id')::uuid
      else md5(v_task_id::text || ':subtask:' || s.ord::text)::uuid
    end,
    v_task_id,
    coalesce(s.item->>'title', ''),
    coalesce((s.item->>'done')::boolean, false),
    s.ord::integer
  from jsonb_array_elements(coalesce(p_task->'subtasks', '[]'::jsonb)) with ordinality as s(item, ord)
  on conflict (id) do update
    set title = excluded.title,
        done = excluded.done,
        position = excluded.position;

  delete from public.task_attachments
  where task_id = v_task_id and not (id = any(v_attachment_ids));
  insert into public.task_attachments (
    id, task_id, project_id, name, size, type, url, uploaded_by
  )
  select
    case
      when a.item->>'id' ~* c_uuid then (a.item->>'id')::uuid
      else md5(v_task_id::text || ':attachment:' || a.ord::text)::uuid
    end,
    v_task_id,
    v_project_id,
    coalesce(a.item->>'name', ''),
    coalesce(a.item->>'size', ''),
    coalesce(a.item->>'type', ''),
    nullif(a.item->>'url', ''),
    case
      when a.item->>'owner' ~* c_uuid
        and exists (select 1 from public.profiles p where p.id = (a.item->>'owner')::uuid)
        then (a.item->>'owner')::uuid
      else null
    end
  from jsonb_array_elements(coalesce(p_task->'attachments', '[]'::jsonb)) with ordinality as a(item, ord)
  on conflict (id) do update
    set name = excluded.name,
        size = excluded.size,
        type = excluded.type,
        url = excluded.url;

  perform public.log_audit('saved task ' || v_title);
  return (select public.task_json(t) from public.tasks t where t.id = v_task_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- JSON builders + workspace loader
-- ---------------------------------------------------------------------------
create or replace function public.member_json(p public.profiles)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'email', p.email,
    'role', p.role,
    'title', p.title,
    'avatar', p.avatar,
    'color', p.color,
    'status', p.status,
    'capacity', p.capacity,
    'hours', p.hours,
    'leave', p.leave
  );
$$;

create or replace function public.task_json(t public.tasks)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', t.id,
    'projectId', t.project_id,
    'title', t.title,
    'description', t.description,
    'status', t.status,
    'priority', t.priority,
    'due', t.due_date,
    'recurring', t.recurring,
    'estimate', t.estimate,
    'spent', t.spent,
    'updatedAt', t.updated_at,
    'subtasks', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'done', s.done)
                       order by s.position, s.created_at)
      from public.task_subtasks s where s.task_id = t.id
    ), '[]'::jsonb),
    -- checklist is still stored on tasks; it is a private per-user checklist,
    -- not shared collaboration data like the three tables above.
    'checklist', coalesce(t.checklist, '[]'::jsonb),
    'attachments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'name', a.name, 'size', a.size, 'owner', a.uploaded_by,
        'type', a.type, 'url', a.url
      ) order by a.created_at)
      from public.task_attachments a where a.task_id = t.id
    ), '[]'::jsonb),
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'author', c.author_id, 'text', c.body,
        'time', to_char(c.created_at, 'HH24:MI'), 'reactions', c.reactions
      ) order by c.created_at)
      from public.task_comments c where c.task_id = t.id
    ), '[]'::jsonb),
    'dependencies', to_jsonb(coalesce(t.dependencies, '{}'::uuid[])),
    'labels', coalesce((
      select jsonb_agg(tl.label_id) from public.task_labels tl where tl.task_id = t.id
    ), '[]'::jsonb),
    'assignees', coalesce((
      select jsonb_agg(ta.user_id) from public.task_assignees ta where ta.task_id = t.id
    ), '[]'::jsonb)
  );
$$;

create or replace function public.project_json(p public.projects)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'status', p.status,
    'start', p.start_date,
    'end', p.end_date,
    'budget', p.budget,
    'customerId', p.customer_id,
    'progress', p.progress,
    'description', p.description,
    'sprint', p.sprint,
    'preview', p.preview,
    'visibility', p.visibility,
    'customFields', coalesce(p.custom_fields, '{}'::jsonb),
    'customStatuses', to_jsonb(coalesce(p.custom_statuses, '{}'::text[])),
    'members', coalesce((
      select jsonb_agg(pm.user_id) from public.project_members pm where pm.project_id = p.id
    ), '[]'::jsonb),
    'memberRoles', coalesce((
      select jsonb_object_agg(pm.user_id::text, pm.role) from public.project_members pm where pm.project_id = p.id
    ), '{}'::jsonb),
    'labels', coalesce((
      select jsonb_agg(pl.label_id) from public.project_labels pl where pl.project_id = p.id
    ), '[]'::jsonb),
    'milestones', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'date', m.date, 'done', m.done) order by m.date)
      from public.milestones m where m.project_id = p.id
    ), '[]'::jsonb),
    'docs', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'body', d.body) order by d.updated_at desc)
      from public.project_docs d where d.project_id = p.id
    ), '[]'::jsonb),
    'chat', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'author', c.author_id, 'text', c.text, 'time', to_char(c.created_at, 'HH24:MI')) order by c.created_at)
      from public.chat_messages c where c.project_id = p.id
    ), '[]'::jsonb),
    'files', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'size', f.size, 'owner', f.owner_id, 'type', f.type, 'url', f.url) order by f.created_at desc)
      from public.project_files f where f.project_id = p.id
    ), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'text', a.text, 'time', to_char(a.created_at, 'HH24:MI')) order by a.created_at desc)
      from public.activities a where a.project_id = p.id
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(public.task_json(t) order by t.created_at)
      from public.tasks t where t.project_id = p.id
    ), '[]'::jsonb)
  );
$$;

create or replace function public.get_workspace()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'user', (
      select public.member_json(p) || jsonb_build_object('permissions', public.permissions_for(p.role))
      from public.profiles p
      where p.id = auth.uid() and not p.disabled
    ),
    'projects', coalesce((
      select jsonb_agg(public.project_json(p) order by p.created_at desc)
      from public.projects p
      where public.can_view_project(p.id)
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(public.member_json(m) order by m.created_at)
      from public.profiles m
      where not m.disabled
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', tm.id, 'name', tm.name,
        'members', coalesce((
          select jsonb_agg(tm2.user_id) from public.team_members tm2 where tm2.team_id = tm.id
        ), '[]'::jsonb)
      ) order by tm.name)
      from public.teams tm
    ), '[]'::jsonb),
    'workspaceInvites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'email', i.email, 'name', i.name, 'role', i.role,
        'projectIds', to_jsonb(i.project_ids), 'projectRole', i.project_role,
        'expiresAt', i.expires_at, 'acceptedAt', i.accepted_at
      ) order by i.created_at desc)
      from public.workspace_invites i
    ), '[]'::jsonb),
    'labels', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name, 'color', l.color) order by l.name)
      from public.labels l
    ), '[]'::jsonb),
    'customers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'contact', c.contact, 'email', c.email, 'status', c.status, 'value', c.value,
        'projects', coalesce((
          select jsonb_agg(p.id) from public.projects p where p.customer_id = c.id
        ), '[]'::jsonb)
      ) order by c.created_at desc)
      from public.customers c
    ), '[]'::jsonb),
    'leads', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'company', l.company, 'contact', l.contact, 'value', l.value,
        'stage', l.stage, 'owner', l.owner_id, 'source', l.source
      ) order by l.created_at desc)
      from public.leads l
    ), '[]'::jsonb),
    'invoices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'client', i.client, 'project', i.project_id, 'amount', i.amount,
        'status', i.status, 'issued', i.issued, 'due', i.due
      ) order by i.created_at desc)
      from public.invoices i
    ), '[]'::jsonb),
    'expenses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'project', e.project_id, 'category', e.category, 'vendor', e.vendor,
        'amount', e.amount, 'date', e.date, 'receipt', e.receipt, 'note', e.note
      ) order by e.date desc, e.created_at desc)
      from public.expenses e
    ), '[]'::jsonb),
    'goals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'title', g.title, 'progress', g.progress, 'owner', g.owner_id, 'quarter', g.quarter
      ) order by g.created_at)
      from public.goals g
    ), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'text', n.text, 'read', n.read, 'time', n.created_at) order by n.created_at desc)
      from public.notifications n
      where n.user_id = auth.uid()
    ), '[]'::jsonb),
    'audit', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'actor', coalesce(p.name, 'System'), 'action', a.action, 'time', a.created_at) order by a.created_at desc)
      from (
        select * from public.audit_log order by created_at desc limit 50
      ) a
      left join public.profiles p on p.id = a.user_id
    ), '[]'::jsonb),
    'savedViews', coalesce((
      select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'filters', v.filters, 'projectId', v.project_id) order by v.created_at desc)
      from public.saved_views v
      where v.user_id = auth.uid()
    ), '[]'::jsonb),
    'automations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'name', a.name, 'trigger', a.trigger, 'condition', a.condition, 'action', a.action, 'enabled', a.enabled
      ) order by a.created_at)
      from public.automations a
    ), '[]'::jsonb),
    'settings', coalesce((
      select jsonb_object_agg(s.key, s.value) from public.workspace_settings s
    ), '{}'::jsonb),
    'notificationsPrefs', coalesce((
      select p.notification_prefs from public.profiles p where p.id = auth.uid()
    ), '{"inApp":true,"email":true,"push":false,"mentions":true,"deadlines":true}'::jsonb),
    'timeEntries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'member', t.user_id, 'project', t.project_id, 'task', t.task,
        'hours', t.hours, 'date', t.date, 'note', t.note
      ) order by t.date desc)
      from public.time_entries t
    ), '[]'::jsonb),
    'activityPresence', coalesce((
      select jsonb_agg(p.id) from public.profiles p where p.status = 'online' and not p.disabled
    ), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.labels enable row level security;
alter table public.customers enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_labels enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_labels enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_subtasks enable row level security;
alter table public.task_attachments enable row level security;
alter table public.milestones enable row level security;
alter table public.project_docs enable row level security;
alter table public.project_files enable row level security;
alter table public.chat_messages enable row level security;
alter table public.activities enable row level security;
alter table public.leads enable row level security;
alter table public.invoices enable row level security;
alter table public.expenses enable row level security;
alter table public.goals enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;
alter table public.saved_views enable row level security;
alter table public.automations enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.time_entries enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated using (true);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
for update to authenticated
using (id = auth.uid() or public.has_permission('team:write'))
with check (id = auth.uid() or public.has_permission('team:write'));

-- teams
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams
for select to authenticated using (public.has_permission('team:read'));

drop policy if exists teams_write on public.teams;
create policy teams_write on public.teams
for all to authenticated
using (public.has_permission('team:write'))
with check (public.has_permission('team:write'));

drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members
for select to authenticated using (public.has_permission('team:read'));

drop policy if exists team_members_write on public.team_members;
create policy team_members_write on public.team_members
for all to authenticated
using (public.has_permission('team:write'))
with check (public.has_permission('team:write'));

-- invites
drop policy if exists invites_select on public.workspace_invites;
create policy invites_select on public.workspace_invites
for select to authenticated using (public.has_permission('team:read'));

-- labels
drop policy if exists labels_select on public.labels;
create policy labels_select on public.labels
for select to authenticated using (public.has_permission('projects:read'));

drop policy if exists labels_write on public.labels;
create policy labels_write on public.labels
for all to authenticated
using (public.has_permission('projects:write'))
with check (public.has_permission('projects:write'));

-- customers
drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers
for select to authenticated using (public.has_permission('customers:read'));

drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers
for insert to authenticated with check (public.has_permission('customers:write'));

drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers
for update to authenticated
using (public.has_permission('customers:write'))
with check (public.has_permission('customers:write'));

drop policy if exists customers_delete on public.customers;
create policy customers_delete on public.customers
for delete to authenticated using (public.has_permission('customers:delete'));

-- projects
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
for select to authenticated using (public.can_view_project(id));

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
for insert to authenticated with check (public.has_permission('projects:write'));

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
for update to authenticated
using (public.can_write_project(id) and public.can_view_project(id))
with check (public.can_write_project(id));

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
for delete to authenticated using (public.has_permission('projects:delete'));

-- project joins
drop policy if exists project_members_select on public.project_members;
create policy project_members_select on public.project_members
for select to authenticated using (public.can_view_project(project_id));

drop policy if exists project_members_write on public.project_members;
create policy project_members_write on public.project_members
for all to authenticated
using (public.can_manage_project_members(project_id))
with check (
  public.can_manage_project_members(project_id)
  and public.can_assign_project_role(project_id, role)
);

drop policy if exists project_labels_select on public.project_labels;
create policy project_labels_select on public.project_labels
for select to authenticated using (public.can_view_project(project_id));

drop policy if exists project_labels_write on public.project_labels;
create policy project_labels_write on public.project_labels
for all to authenticated
using (public.can_write_project(project_id))
with check (public.can_write_project(project_id));

-- tasks
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
for select to authenticated using (public.has_permission('tasks:read') and public.can_view_project(project_id));

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
for insert to authenticated with check (public.can_create_task(project_id));

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
for update to authenticated
using (public.can_write_task(id) and public.can_view_project(project_id))
with check (public.can_write_task(id));

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
for delete to authenticated using (public.has_permission('tasks:delete'));

-- task joins
drop policy if exists task_assignees_select on public.task_assignees;
create policy task_assignees_select on public.task_assignees
for select to authenticated using (public.can_view_task(task_id));

drop policy if exists task_assignees_write on public.task_assignees;
create policy task_assignees_write on public.task_assignees
for all to authenticated
using (
  public.can_manage_project_members((select t.project_id from public.tasks t where t.id = task_id))
)
with check (
  public.can_manage_project_members((select t.project_id from public.tasks t where t.id = task_id))
);

drop policy if exists task_labels_select on public.task_labels;
create policy task_labels_select on public.task_labels
for select to authenticated using (public.can_view_task(task_id));

drop policy if exists task_labels_write on public.task_labels;
create policy task_labels_write on public.task_labels
for all to authenticated
using (public.can_write_task(task_id))
with check (public.can_write_task(task_id));

-- normalized task children
drop policy if exists task_comments_select on public.task_comments;
create policy task_comments_select on public.task_comments
for select to authenticated using (public.can_view_task(task_id));

drop policy if exists task_comments_write on public.task_comments;
create policy task_comments_write on public.task_comments
for all to authenticated
using (public.can_write_task(task_id))
with check (public.can_write_task(task_id));

drop policy if exists task_subtasks_select on public.task_subtasks;
create policy task_subtasks_select on public.task_subtasks
for select to authenticated using (public.can_view_task(task_id));

drop policy if exists task_subtasks_write on public.task_subtasks;
create policy task_subtasks_write on public.task_subtasks
for all to authenticated
using (public.can_write_task(task_id))
with check (public.can_write_task(task_id));

drop policy if exists task_attachments_select on public.task_attachments;
create policy task_attachments_select on public.task_attachments
for select to authenticated using (public.can_view_task(task_id));

drop policy if exists task_attachments_write on public.task_attachments;
create policy task_attachments_write on public.task_attachments
for all to authenticated
using (public.can_write_task(task_id))
with check (public.can_write_task(task_id));

-- project children
drop policy if exists milestones_select on public.milestones;
create policy milestones_select on public.milestones
for select to authenticated using (public.can_view_project(project_id));

drop policy if exists milestones_write on public.milestones;
create policy milestones_write on public.milestones
for all to authenticated
using (public.can_write_project(project_id))
with check (public.can_write_project(project_id));

drop policy if exists docs_select on public.project_docs;
create policy docs_select on public.project_docs
for select to authenticated using (public.can_view_project(project_id));

drop policy if exists docs_write on public.project_docs;
create policy docs_write on public.project_docs
for all to authenticated
using (public.can_write_project(project_id))
with check (public.can_write_project(project_id));

drop policy if exists files_select on public.project_files;
create policy files_select on public.project_files
for select to authenticated using (public.can_view_project(project_id));

drop policy if exists files_write on public.project_files;
create policy files_write on public.project_files
for all to authenticated
using (public.has_permission('tasks:write'))
with check (public.has_permission('tasks:write'));

drop policy if exists chat_select on public.chat_messages;
create policy chat_select on public.chat_messages
for select to authenticated using (public.can_view_project(project_id));

drop policy if exists chat_write on public.chat_messages;
create policy chat_write on public.chat_messages
for all to authenticated
using (public.has_permission('tasks:write'))
with check (public.has_permission('tasks:write'));

drop policy if exists activities_select on public.activities;
create policy activities_select on public.activities
for select to authenticated using (public.can_view_project(project_id));

drop policy if exists activities_write on public.activities;
create policy activities_write on public.activities
for all to authenticated
using (public.has_permission('tasks:write'))
with check (public.has_permission('tasks:write'));

-- leads
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads
for select to authenticated using (public.has_permission('leads:read'));

drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads
for insert to authenticated with check (public.has_permission('leads:write'));

drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads
for update to authenticated
using (public.has_permission('leads:write'))
with check (public.has_permission('leads:write'));

drop policy if exists leads_delete on public.leads;
create policy leads_delete on public.leads
for delete to authenticated using (public.has_permission('leads:delete'));

-- invoices
drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices
for select to authenticated using (public.has_permission('invoices:read'));

drop policy if exists invoices_write on public.invoices;
create policy invoices_write on public.invoices
for all to authenticated
using (public.has_permission('invoices:write'))
with check (public.has_permission('invoices:write'));

-- expenses
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
for select to authenticated using (public.has_permission('expenses:read'));

drop policy if exists expenses_write on public.expenses;
create policy expenses_write on public.expenses
for all to authenticated
using (public.has_permission('expenses:write'))
with check (public.has_permission('expenses:write'));

-- goals
drop policy if exists goals_select on public.goals;
create policy goals_select on public.goals
for select to authenticated using (public.has_permission('analytics:read'));

drop policy if exists goals_write on public.goals;
create policy goals_write on public.goals
for all to authenticated
using (public.has_permission('analytics:read'))
with check (public.has_permission('analytics:read'));

-- notifications
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
for select to authenticated using (user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
for insert to authenticated with check (user_id = auth.uid());

-- audit
drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log
for select to authenticated using (public.has_permission('team:read'));

drop policy if exists audit_insert on public.audit_log;
create policy audit_insert on public.audit_log
for insert to authenticated with check (user_id = auth.uid());

-- saved views
drop policy if exists saved_views_all on public.saved_views;
create policy saved_views_all on public.saved_views
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- automations
drop policy if exists automations_select on public.automations;
create policy automations_select on public.automations
for select to authenticated using (public.has_permission('team:read'));

drop policy if exists automations_write on public.automations;
create policy automations_write on public.automations
for all to authenticated
using (public.has_permission('settings:write'))
with check (public.has_permission('settings:write'));

-- workspace settings
drop policy if exists settings_select on public.workspace_settings;
create policy settings_select on public.workspace_settings
for select to authenticated using (true);

drop policy if exists settings_write on public.workspace_settings;
create policy settings_write on public.workspace_settings
for all to authenticated
using (public.has_permission('settings:write'))
with check (public.has_permission('settings:write'));

-- time entries
drop policy if exists time_entries_select on public.time_entries;
create policy time_entries_select on public.time_entries
for select to authenticated using (user_id = auth.uid() or public.has_permission('analytics:read'));

drop policy if exists time_entries_insert on public.time_entries;
create policy time_entries_insert on public.time_entries
for insert to authenticated with check (user_id = auth.uid() and public.has_permission('tasks:write'));

drop policy if exists time_entries_update on public.time_entries;
create policy time_entries_update on public.time_entries
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists time_entries_delete on public.time_entries;
create policy time_entries_delete on public.time_entries
for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime publication. Guarded so the script also runs on plain Postgres.
-- ---------------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array['chat_messages', 'tasks', 'notifications', 'project_members'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end $$;

-- Keep old row values in UPDATE/DELETE events for tasks and project members.
alter table public.tasks replica identity full;
alter table public.project_members replica identity full;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

revoke execute on function public.get_workspace() from public, anon;
revoke execute on function public.invite_member(text, text, text, text, uuid[], public.project_role, timestamptz) from public, anon;
revoke execute on function public.set_member_role(uuid, text) from public, anon;
revoke execute on function public.remove_member(uuid) from public, anon;
revoke execute on function public.add_project_member(uuid, uuid, public.project_role) from public, anon;
revoke execute on function public.set_project_member_role(uuid, uuid, public.project_role) from public, anon;
revoke execute on function public.remove_project_member(uuid, uuid) from public, anon;
revoke execute on function public.add_team_to_project(uuid, uuid, public.project_role) from public, anon;
revoke execute on function public.upsert_task_checked(jsonb, timestamptz) from public, anon;
revoke execute on function public.log_audit(text) from public, anon;
revoke execute on function public.notify_user(uuid, text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_profile() from public, anon, authenticated;
revoke execute on function public.trg_project_member_notify() from public, anon, authenticated;
revoke execute on function public.trg_task_assigned_notify() from public, anon, authenticated;
revoke execute on function public.trg_task_comment_notify() from public, anon, authenticated;
revoke execute on function public.trg_task_assignee_member_check() from public, anon, authenticated;
revoke execute on function public.trg_workspace_role_notify() from public, anon, authenticated;

grant execute on function public.workspace_status() to anon, authenticated;
grant execute on function public.get_workspace() to authenticated;
grant execute on function public.invite_member(text, text, text, text, uuid[], public.project_role, timestamptz) to authenticated;
grant execute on function public.set_member_role(uuid, text) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.add_project_member(uuid, uuid, public.project_role) to authenticated;
grant execute on function public.set_project_member_role(uuid, uuid, public.project_role) to authenticated;
grant execute on function public.remove_project_member(uuid, uuid) to authenticated;
grant execute on function public.add_team_to_project(uuid, uuid, public.project_role) to authenticated;
grant execute on function public.upsert_task_checked(jsonb, timestamptz) to authenticated;
grant execute on function public.log_audit(text) to authenticated;

-- Keep the workspace label empty by default; no demo rows.
insert into public.workspace_settings (key, value)
values ('org', '"Workspace"'::jsonb), ('plan', '"Local"'::jsonb)
on conflict (key) do nothing;

-- Make the new RPCs/tables available to PostgREST immediately.
notify pgrst, 'reload schema';
