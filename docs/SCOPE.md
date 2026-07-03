# AIGTM — Scope

Internal AI-assisted GTM / lead generation tool for Cloudculate. Single
admin user, no billing or multi-tenant concerns.

Researched against getswan.com, Clay, Warmly, and Apollo before writing
any code. Common pattern across all of them: **Source → Enrich →
Score/Qualify → Sync to CRM → Alert → Engage**, with a human able to
intervene at any stage. AIGTM follows the same shape.

## HubSpot — temporarily paused

HubSpot's OAuth app creation requires a plan tier we don't currently
have. HubSpot-specific code (routes, webhook handler) has been pulled
out of the active app rather than left half-wired — it's still in git
history and the Prisma schema still has the `hubspot` provider value and
`hubspotContactId`/`hubspotCompanyId` columns, so re-adding it later is
a restore, not a rebuild. Everything below still describes the intended
end state; HubSpot-dependent items are marked accordingly.

## Phase 1 (MVP) — current focus

- **HubSpot sync** *(paused — plan upgrade needed)* — pull existing
  contacts/companies/deals, write back enrichment and scores.
- **Lead scoring** — rules-based ICP fit + AI qualification against
  defined criteria and deal-breakers.
- **Enrichment** — waterfall lookup starting with one data provider for
  firmographic/contact data.
- **Gmail integration** — AI drafts personalized outreach as Gmail
  drafts (OAuth, draft-only; a human sends). Reply detection via
  metadata-only scope to stop/flag sequences.
- **Slack alerts** — new qualified lead, enrichment complete, reply
  received, with interactive approve/assign actions.
- **Dashboard** — lead list/pipeline view, score breakdown, source
  tracking.
- **Admin** — ICP rule builder, OAuth connection management.

## Phase 2

- Outbound prospecting: ICP-filtered lead list building from a data
  provider.
- Sequenced multi-touch outreach (still draft-first).

## Phase 3

- Website visitor de-anonymization (tracking pixel + identity
  resolution provider).

## Explicit non-goals for now

- No auto-send of outreach email — every send requires human approval
  (see `SECURITY.md`).
- No multi-tenant auth/billing — single admin session only.
- No LinkedIn automation.
