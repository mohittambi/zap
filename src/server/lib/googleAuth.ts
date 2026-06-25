/**
 * Minimal Google service account auth using jsonwebtoken (already in project).
 * No googleapis package needed — just a signed JWT exchanged for an access token.
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  — e.g. sync@my-project.iam.gserviceaccount.com
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY — PEM key from service account JSON
 *                                        (newlines as \n literal in .env.local)
 */

import jwt from 'jsonwebtoken';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

type CachedToken = { access_token: string; expires_at: number };
let cached: CachedToken | null = null;

function getCredentials(): { email: string; privateKey: string } {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error(
      'Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY env vars'
    );
  }
  // Support literal \n in env files (common in .env.local)
  const privateKey = rawKey.replace(/\\n/g, '\n');
  return { email, privateKey };
}

function buildAssertion(email: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: email,
      scope: SHEETS_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    },
    privateKey,
    { algorithm: 'RS256' }
  );
}

/**
 * Returns a valid access token, using an in-process cache.
 * Re-fetches 60 seconds before expiry to avoid clock-skew races.
 */
export async function getAccessToken(): Promise<string> {
  const nowMs = Date.now();
  if (cached && cached.expires_at > nowMs + 60_000) {
    return cached.access_token;
  }

  const { email, privateKey } = getCredentials();
  const assertion = buildAssertion(email, privateKey);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Google token exchange failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = {
    access_token: json.access_token,
    expires_at: nowMs + json.expires_in * 1000,
  };
  return cached.access_token;
}
