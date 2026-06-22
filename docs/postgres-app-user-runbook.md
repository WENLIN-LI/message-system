# PostgreSQL App User Runbook

Message System currently calls `PostgresStore.initializeSchema()` on startup in
PostgreSQL mode. The runtime database role therefore needs enough ownership and
schema privileges to run the idempotent startup DDL in
`server/src/repositories/postgresSchema.ts`.

This runbook replaces the broad `postgres` runtime role with a dedicated
`message-system_app` role while keeping the current startup flow compatible.

## Create Or Update The Role

Generate a password outside the repository:

```bash
openssl rand -base64 36 > /private/tmp/message-system_app_db_password
chmod 600 /private/tmp/message-system_app_db_password
```

Run the provisioner with an admin-capable `DATABASE_URL`:

```bash
cd server
APP_DATABASE_USER=message-system_app \
APP_DATABASE_PASSWORD="$(cat /private/tmp/message-system_app_db_password)" \
npm run provision:postgres-app-user
```

The script:

- creates or updates `message-system_app` with `NOSUPERUSER`, `NOCREATEDB`, and
  `NOCREATEROLE`;
- grants database connect and `public` schema usage/create privileges;
- transfers known Message System table ownership to `message-system_app`;
- grants table and sequence access required by the application.

It only targets the known Message System tables listed in the script. It does not
reassign all objects owned by `postgres`.

## Verify Before Switching

Build a connection URL using the same host/database as production, but with
`message-system_app` and the generated password. Then verify:

```sql
SELECT current_user;
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole
FROM pg_roles
WHERE rolname = current_user;
```

Expected:

```text
current_user = message-system_app
rolsuper = false
rolcreatedb = false
rolcreaterole = false
```

Also run a disposable smoke test against a non-production database when
available:

```bash
TEST_DATABASE_URL="postgres://message-system_app:...@host:5432/message_system_test" \
npm run smoke:persistence
```

## Switch Production

Only switch after the role has been verified:

```bash
fly secrets set DATABASE_URL="postgres://message-system_app:<password>@<host>:5432/<db>"
```

This restarts the Fly app. Verify immediately:

```bash
curl https://message-system.fly.dev/api/status
```

Rollback is the previous `DATABASE_URL` secret using the existing admin-capable
role.

## Future Hardening

The stricter end state is two roles:

- `message-system_migrator`: used by deployment to run schema migrations.
- `message-system_app`: used at runtime with only DML privileges.

That requires changing startup so production does not automatically run
`initializeSchema()` on every boot.
