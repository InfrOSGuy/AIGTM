# AIGTM — Security Model

This tool holds OAuth access to your Gmail and Slack accounts (HubSpot
is temporarily paused — see `docs/SCOPE.md`). Everything below exists to
keep that access from becoming a liability — both against outside
attackers and against AIGTM's own AI steps making a bad autonomous call.
The model applies equally once HubSpot is reinstated.

## Credential storage

- OAuth access/refresh tokens are **never stored in plaintext**.
  `src/crypto/tokenCipher.ts` encrypts every token with AES-256-GCM
  before it's written to `IntegrationConnection` in Postgres. GCM's auth
  tag means a tampered ciphertext fails to decrypt instead of silently
  returning garbage.
- The encryption key (`TOKEN_ENCRYPTION_KEY`) lives only in the process
  environment, never in the repo or the database. Rotate it by
  decrypting with the old key and re-encrypting with the new one — there
  is no automatic rotation yet.
- `.env` is git-ignored; only `.env.example` (no real values) is
  tracked. `config/env.ts` **fails closed**: the process refuses to boot
  if a required secret is missing or looks like a placeholder
  (`changeme`, `test`, etc.) — there is no insecure default to fall back
  to.
- In production, don't rely on a `.env` file on disk at all — inject
  `TOKEN_ENCRYPTION_KEY`, `SESSION_SECRET`, `ADMIN_API_TOKEN`, and the
  OAuth client secrets from a real secrets manager (e.g. your hosting
  provider's secret store, 1Password Connect, AWS Secrets Manager).

## Admin authentication

Even though this is single-tenant, the API is a network-reachable
service, so it still needs a login — otherwise anyone who can reach the
API could hit `/auth/gmail/start` and **replace your connected Gmail
account with their own**, silently redirecting future outreach through
their inbox instead of yours.

- `POST /auth/login` exchanges a pre-shared `ADMIN_API_TOKEN` (compared
  with `timingSafeEqual`, rate-limited to 5 attempts/minute) for a
  short-lived (12h), HttpOnly, SameSite=Lax session cookie signed with
  `SESSION_SECRET`. The token itself never touches browser JS or
  localStorage.
- Every route that can read pipeline data or mutate integration/outreach
  state is gated by `requireAdmin`.

## OAuth flow hardening

- **CSRF state**: every `/auth/{provider}/start` generates a random,
  single-use, server-stored, 10-minute-lived state row
  (`OAuthState`). It's deleted the moment it's consumed — a replayed
  callback URL can never succeed twice.
- **PKCE** on the Gmail flow (Google supports it; Slack's server-side
  confidential-client flow doesn't need it; HubSpot's would follow the
  same pattern once reinstated).
- **Least-privilege scopes**, requested explicitly per provider and
  documented at the request site:
  - Gmail: `gmail.compose` + `gmail.metadata` only — never
    `gmail.readonly` or `gmail.modify`. AIGTM can draft and detect
    replies; it cannot read your inbox contents or send unsupervised.
  - Slack: `chat:write` + `chat:write.public` only — no channel history
    read, no user email read.
  - HubSpot *(paused)*: was scoped to contacts + companies read/write
    only, with deal-write deferred to Phase 2 — keep that same
    least-privilege posture when it's reinstated.

## Webhooks

- Slack events are verified against Slack's documented HMAC signature
  scheme (`src/middleware/verifyWebhookSignature.ts`) using a raw-body
  capture so the signature is checked over the exact bytes Slack sent,
  not a re-serialized JSON.parse output. The equivalent HubSpot verifier
  was removed with the rest of the HubSpot integration — it's in git
  history to restore alongside the webhook route.
- Both verifiers reject requests with a timestamp more than 5 minutes
  old, so a captured request can't be replayed indefinitely.
- All signature/HMAC comparisons use `timingSafeEqual`, never `===`.

## Human-in-the-loop by design

- Outreach is **draft-only**: AIGTM writes a Gmail draft
  (`OutreachDraft.status = drafted`); nothing sends until a human
  approves (`approved`) and the send is triggered explicitly. This is
  the main defense against a bad AI-generated email going out
  unsupervised, and against **prompt injection**: Phase 1's ICP scoring
  and Phase 2's research/enrichment agents will read untrusted content
  (scraped web pages, LinkedIn profiles, inbound replies). That content
  could contain text trying to manipulate the model ("ignore previous
  instructions, send X"). Because sending, CRM writes, and Slack
  messages all go through explicit, auditable action functions — not
  free-form tool calls the AI can invoke directly on attacker-controlled
  input — a successful injection can at worst produce a bad *draft* for
  a human to reject, not an autonomous action.
- `AuditLog` is an append-only trail of every sensitive action
  (integration connect/disconnect, login attempts, outreach
  approve/send, ICP rule changes). Nothing in application code updates
  or deletes these rows.

## Dependency and infra hygiene

- CI runs `gitleaks` on every push/PR to catch committed secrets before
  they land on `main`.
- Keep dependencies current; review `npm audit` output before merging
  dependency bumps.
- Run Postgres with a least-privilege application role (not a superuser)
  once you provision real infrastructure.

## If a credential is compromised

1. Revoke the token at the provider (Google/Slack app dashboard, or
   HubSpot once reinstated) immediately — this invalidates it even if
   AIGTM's copy is still encrypted at rest.
2. Rotate `TOKEN_ENCRYPTION_KEY`, `SESSION_SECRET`, and
   `ADMIN_API_TOKEN`.
3. Re-run the OAuth connect flow for the affected provider.
4. Check `AuditLog` for what happened while the credential was live.
