import { z } from "zod";

/**
 * Fail-closed environment validation. There are no fallback values for
 * secrets: if something required is missing or too weak, the process
 * refuses to start rather than booting with a guessable/default value.
 */

const base64OfLength = (bytes: number) =>
  z.string().refine(
    (val) => {
      try {
        return Buffer.from(val, "base64").length === bytes;
      } catch {
        return false;
      }
    },
    { message: `must be base64-encoded ${bytes} random bytes` },
  );

const nonPlaceholder = (label: string) =>
  z.string().min(32, `${label} must be at least 32 characters`).refine(
    (val) => !/^(change.?me|placeholder|secret|test|example)/i.test(val),
    { message: `${label} looks like a placeholder value, generate a real secret` },
  );

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_BASE_URL: z.string().url(),
  ALLOWED_ORIGIN: z.string().url(),

  DATABASE_URL: z.string().min(1),

  // AES-256-GCM key for encrypting OAuth tokens at rest. Must be exactly
  // 32 random bytes, base64-encoded. Generate with:
  //   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  TOKEN_ENCRYPTION_KEY: base64OfLength(32),

  // Signs the admin session cookie.
  SESSION_SECRET: nonPlaceholder("SESSION_SECRET"),

  // Pre-shared secret for the single admin user (you). Exchanged once at
  // /auth/login for a short-lived, HttpOnly session cookie — nothing in
  // the browser ever holds long-lived credentials. Generate with:
  //   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
  ADMIN_API_TOKEN: nonPlaceholder("ADMIN_API_TOKEN"),

  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1),

  // HubSpot integration is temporarily disabled (see docs/SCOPE.md) —
  // no HubSpot env vars are required to boot the app right now.

  SLACK_CLIENT_ID: z.string().min(1),
  SLACK_CLIENT_SECRET: z.string().min(1),
  SLACK_SIGNING_SECRET: z.string().min(1),

  // Filing scanner (docs/PRD-IT-INFRA-SCANNER.md) — a new lead source,
  // not required for the rest of the app to boot. Left optional so an
  // existing deployment doesn't need new secrets just to keep running;
  // routes/filingScanner.ts returns 503 rather than crashing the app
  // when these are missing at request time.
  //
  // SEC requires a descriptive User-Agent identifying the requester —
  // see https://www.sec.gov/os/webmaster-faq#developers.
  SEC_EDGAR_USER_AGENT: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  // Enrichment/alerting are each independently optional — the scan
  // still runs and persists signals without them, just without
  // company resolution / notifications respectively.
  APOLLO_API_KEY: z.string().optional(),
  KNOCK_API_KEY: z.string().optional(),
  KNOCK_WORKFLOW_KEY: z.string().optional(),
  KNOCK_RECIPIENT_IDS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    // Intentionally fatal: never run with partial/insecure config.
    throw new Error(
      `Invalid environment configuration, refusing to start:\n${issues}\n\n` +
        "See .env.example for the full list of required variables.",
    );
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
