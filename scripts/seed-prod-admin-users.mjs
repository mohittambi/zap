/**
 * Seed production admin users (bcrypt passwords, admin role).
 *
 * Usage (prod session pooler only — never .env.local override):
 *   export DATABASE_URL="<prod :5432 session pooler>"
 *   node scripts/seed-prod-admin-users.mjs
 *   node scripts/seed-prod-admin-users.mjs --email saumya@ecraftindia.com --email ankit@ecraftindia.com
 *
 * Passwords are generated and printed once. Store in team vault; rotate after first login.
 */
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");

dotenv.config({ path: path.join(webRoot, ".env") });
if (!process.env.DATABASE_URL?.trim()) {
  dotenv.config({ path: path.join(webRoot, ".env.production.local") });
}

const DEFAULT_EMAILS = ["saumya@ecraftindia.com", "ankit@ecraftindia.com"];

function parseEmails(argv) {
  const emails = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--email" && argv[i + 1]) {
      emails.push(argv[i + 1].trim().toLowerCase());
      i += 1;
    }
  }
  return emails.length > 0 ? [...new Set(emails)] : DEFAULT_EMAILS;
}

function genPassword() {
  return crypto.randomBytes(12).toString("base64url");
}

async function main() {
  const cs = process.env.DATABASE_URL?.trim();
  if (!cs) {
    console.error("DATABASE_URL is required (use prod session pooler :5432)");
    process.exit(1);
  }
  if (!cs.includes("bxgmcddxmlsgrflnbywv")) {
    console.error("Refusing to run: DATABASE_URL does not look like prod project bxgmcddxmlsgrflnbywv");
    process.exit(1);
  }

  const emails = parseEmails(process.argv.slice(2));
  const client = new pg.Client({ connectionString: cs });
  await client.connect();

  await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");

  const adminRole = await client.query(`SELECT id FROM roles WHERE name = 'admin'`);
  if (adminRole.rows.length === 0) {
    throw new Error("admin role missing — run migrations first");
  }
  const adminRoleId = adminRole.rows[0].id;

  const created = [];
  for (const email of emails) {
    const password = genPassword();
    const ins = await client.query(
      `INSERT INTO users (email, password_hash, is_active, created_at, updated_at)
       VALUES ($1, crypt($2, gen_salt('bf')), true, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET
         password_hash = crypt($2, gen_salt('bf')),
         is_active = true,
         updated_at = NOW()
       RETURNING id`,
      [email, password]
    );
    const userId = ins.rows[0].id;
    await client.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [userId, adminRoleId]
    );
    created.push({ email, password, userId });
  }

  console.log(JSON.stringify({ ok: true, admins: created.map(({ email, userId }) => ({ email, userId })) }, null, 2));
  console.log("\n=== TEMPORARY PASSWORDS (store in vault, rotate after first login) ===");
  for (const row of created) {
    console.log(`${row.email}\t${row.password}`);
  }

  await client.end();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
