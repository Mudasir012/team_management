# Migration note: project membership & collaboration layer

## What changes

This migration extends the existing single-file bootstrap (`supabase/schema.sql`)
with project-scoped membership, teams, stricter RLS, collaboration RPCs,
notification triggers and normalized task children. The file remains **idempotent**:
run the whole script again in the Supabase SQL Editor at any time.

### 1. Schema
- New enums `public.project_role` (`lead`, `contributor`, `viewer`, `client`) and
  `public.project_visibility` (`workspace`, `private`). Both are created inside
  guarded `DO` blocks because PostgreSQL has no `CREATE TYPE IF NOT EXISTS`.
- `project_members` gains `role`, `added_by` and `created_at`.
- `projects` gains `visibility` (default `workspace`).
- `workspace_invites` gains `project_ids`, `project_role` and `expires_at`.
- New tables `teams` and `team_members`.

### 2. Visibility and permission helpers
- `can_view_project()` now shows `workspace` projects to every role with
  `projects:read`; `private` projects are visible only to project members and to
  owners/admins. This replaces the previous rule that hid all projects from viewers
  unless they were members.
- New helpers: `project_role_rank()`, `can_manage_project_members()`,
  `can_assign_project_role()`, `can_write_project()`, `can_create_task()` and
  `can_write_task()`.
- `has_permission()` now returns `false` for disabled profiles.

### 3. RLS
- Project writes by managers are limited to projects where they are a
  `lead`/`contributor` member. Owners and admins are unrestricted.
- Task writes are limited to tasks the user is assigned to, created, or that live
  in a project where they are a `lead`/`contributor` member.
- `project_members` writes require `can_manage_project_members()` plus a role the
  caller is allowed to assign.
- New `teams` / `team_members` policies require `team:read` / `team:write`.

### 4. RPCs, triggers, notifications and realtime
- New audit-logged SECURITY DEFINER RPCs for adding/changing/removing project
  members and adding a whole team to a project.
- `invite_member()` is replaced with a backwards-compatible extended signature
  that accepts project memberships and an expiry.
- Database triggers create notifications for project additions, task assignment,
  `@mentions`, comments and role changes.
- `chat_messages`, `tasks`, `notifications` and `project_members` are added to the
  `supabase_realtime` publication.

### 5. Task children normalization
- New tables `task_comments`, `task_subtasks` and `task_attachments`.
- A one-time migration moves existing JSONB entries into those tables.
- `task_json()` reads the new tables but keeps the existing camelCase JSON keys so
  the frontend does not need a shape change. The legacy JSONB columns are retained
  (deprecated) for rollback safety.
- `upsert_task_checked()` performs an optimistic `updated_at` conflict check.

## Running the migration

1. Back up the database.
2. Open Supabase Dashboard → SQL Editor → New query.
3. Paste and run the entire contents of `supabase/schema.sql`.
4. Confirm `select public.workspace_status();` returns JSON.
5. Reload the app; `get_workspace()` now also returns `teams`, `workspaceInvites`
   and per-project `memberRoles` / `visibility`.

The script ends with `notify pgrst, 'reload schema';`. A first run on a fresh
project needs no extra steps. Re-running is safe: all DDL is guarded, and the data
backfill uses `on conflict do nothing`.

## Tests

pgTAP suites live in `supabase/tests/`:

- `01_roles_tables.sql` checks every workspace role against every table.
- `02_project_roles.sql` checks private-project visibility and the project-role
  matrix (lead/contributor/viewer/client, plus owner/admin).
- `03_task_upsert.sql` checks the `updated_at` conflict guard, normalized task
  children, comment notifications and the project-member assignment trigger.

Run them against a local/migration-tested database with the Supabase CLI:

```bash
supabase db test
```

Each file opens and rolls back its own transaction, so it can also be pasted
into a pgTAP-enabled SQL Editor.

## Application-side follow-up

After running the SQL, deploy the frontend in the same release. The frontend now:
- reads permissions from `get_workspace().user.permissions` (no hardcoded matrix),
- no longer asks for a role at login/signup,
- offers a project Members tab and deep links (`/projects/:id`, `/tasks/:id`),
- rolls optimistic edits back when a sync fails.
