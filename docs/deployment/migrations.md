# Database migrations

## Location

Ordered SQL files: `web/migrations/*.sql` (numbered `001_` … `045_` as of this writing).

## Apply

From `web/`:

```bash
npm run migrate
```

This runs `scripts/run_migrations.sh` with env loaded from `.env.local` then `.env` (see `package.json` `migrate` script).

## Rules

1. **Never** edit applied migration files in production — add a **new** file with the next number.
2. Test migrations against a **copy** of production data when possible.
3. On Vercel, run migrations from **CI or your laptop** against the same `DATABASE_URL`, not inside the default serverless build (see [web-setup.md](web-setup.md)).

## Rollback

There is no automatic down-migration. Restore from backup or write a compensating migration.

## See also

- [../architecture/database-schema.md](../architecture/database-schema.md)
