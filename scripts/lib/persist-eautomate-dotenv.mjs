/**
 * Upsert EAUTOMATE_COOKIE (and optional login vars) into .env.local after a successful login.
 *
 * Opt-in: EAUTOMATE_WRITE_AUTH_TO_ENV_LOCAL=1
 * File: EAUTOMATE_ENV_FILE or <cwd>/.env.local
 *
 * Values are double-quoted for dotenv (JWTs contain = and ;).
 */
import fs from "node:fs";
import path from "node:path";

function resolveDotenvPath() {
  const e = process.env.EAUTOMATE_ENV_FILE?.trim();
  if (e) return path.isAbsolute(e) ? e : path.join(process.cwd(), e);
  return path.join(process.cwd(), ".env.local");
}

function quoteDotenvValue(v) {
  return `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\n")}"`;
}

function lineKey(line) {
  const m = /^\s*([^=#\s]+)\s*=/.exec(line);
  return m ? m[1] : null;
}

/**
 * @param {string} filePath
 * @param {Record<string, string>} updates
 */
function upsertEnvKeys(filePath, updates) {
  const keys = Object.keys(updates);
  if (keys.length === 0) return;

  let raw = "";
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  const lines = raw.length === 0 ? [] : raw.replace(/\r\n/g, "\n").split("\n");
  const pending = { ...updates };
  for (let i = 0; i < lines.length; i += 1) {
    const k = lineKey(lines[i]);
    if (k && pending[k] !== undefined) {
      lines[i] = `${k}=${quoteDotenvValue(pending[k])}`;
      delete pending[k];
    }
  }
  if (Object.keys(pending).length > 0 && lines.length > 0 && lines[lines.length - 1] !== "") {
    lines.push("");
  }
  for (const [k, v] of Object.entries(pending)) {
    lines.push(`${k}=${quoteDotenvValue(v)}`);
  }

  const dir = path.dirname(filePath);
  if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
}

export function persistEautomateAuthAfterLoginIfEnabled() {
  if (process.env.EAUTOMATE_WRITE_AUTH_TO_ENV_LOCAL !== "1") return;

  const updates = {};
  const cookie = process.env.EAUTOMATE_COOKIE?.trim();
  if (cookie) updates.EAUTOMATE_COOKIE = cookie;

  const uid = process.env.EAUTOMATE_LOGIN_USER_ID?.trim();
  if (uid) updates.EAUTOMATE_LOGIN_USER_ID = uid;

  const pass = process.env.EAUTOMATE_LOGIN_PASSWORD;
  if (pass != null && String(pass) !== "") {
    updates.EAUTOMATE_LOGIN_PASSWORD = String(pass);
  }

  if (Object.keys(updates).length === 0) return;

  try {
    const filePath = resolveDotenvPath();
    upsertEnvKeys(filePath, updates);
    console.log(
      `[eautomate-dotenv] Updated ${Object.keys(updates).join(", ")} in ${filePath}`
    );
  } catch (e) {
    console.warn("[eautomate-dotenv] Failed to write .env.local:", e?.message || e);
  }
}
