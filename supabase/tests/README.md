# pgTAP tests

These suites verify the membership/collaboration layer added in
`supabase/schema.sql`.

| File | Coverage |
| --- | --- |
| `01_roles_tables.sql` | All five workspace roles × all 30 tables (150 assertions). |
| `02_project_roles.sql` | Private-project visibility, scoped manager writes, and the project-role matrix. |
| `03_task_upsert.sql` | Normalized task children, `updated_at` conflict checks, comment notifications, and the project-member assignment trigger. |

## Running

With the Supabase CLI installed and a local database running:

```bash
supabase start
supabase db reset      # applies supabase/schema.sql
supabase db test
```

Each file is self-contained: it begins a transaction, installs deterministic
fixtures, calls `plan()`/`finish()`, and rolls back. They can also be pasted
one at a time into a SQL Editor that has pgTAP installed.

Fixtures use fixed UUIDs in the `1000…`, `2000…`, `3000…` and `4000…` ranges and
emails ending in `@example.test`, so they are easy to spot and safe to roll back.
