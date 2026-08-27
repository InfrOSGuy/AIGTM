# PRD — IT Infrastructure Signal Scanner

**Status:** Draft for review
**Owner:** Cloudculate GTM
**Relationship to AIGTM:** a new lead **source** feeding the existing
Source → Enrich → Score → Sync → Alert → Engage pipeline described in
`docs/SCOPE.md`. It replaces the Reddit-based signal source, which is
being retired as a lead channel.

## 1. Problem

Cloudculate needs a reliable, repeatable signal of *buying intent* for
IT infrastructure work (cloud migration, data center consolidation,
ERP/platform replatforming, network or security overhauls, M&A-driven
IT integration, etc.). Reddit-sourced signals were noisy, hard to
attribute to a real company, and easy for the underlying communities to
shut off (rate limits, API changes, moderation) — it stopped being a
dependable channel.

Public and private companies routinely disclose IT investment plans in
their own words: annual reports (10-K), quarterly reports (10-Q),
earnings call transcripts, and investor presentations. These documents
are: (a) produced on a predictable cadence, (b) written by the company
itself (so intent is stated directly, not inferred from a third party),
and (c) public record for SEC filers, so there's no ToS or scraping risk
comparable to Reddit's. This is a slower-moving but higher-trust and more
durable signal source.

## 2. Goal

Build a scanner that ingests business filings, extracts passages that
indicate a company is starting, expanding, or actively managing an IT
infrastructure initiative, and surfaces a scored, evidenced shortlist of
target companies into AIGTM's existing pipeline — replacing Reddit as a
top-of-funnel source.

**Primary metric:** qualified leads/month handed to the existing
scoring+outreach pipeline, at a precision Cloudculate's GTM team judges
acceptable during manual review (target ≥60% of surfaced hits judged
"relevant" in Phase 1 review — see §9).

**Secondary metric:** time from filing publication to lead surfaced via
Knock-ai (§8 target: same day for EDGAR full-text-search-indexed
filings).

## 3. Non-goals (v1)

- Not a general financial-analysis or investment-research tool — it
  only extracts IT-infrastructure-relevant signal, not full filing
  summarization.
- Not scraping paywalled, subscription, or ToS-restricted report
  sources. v1 covers only what's legally public (SEC EDGAR; investor
  relations pages a company itself publishes).
- Not covering private companies with no public disclosure obligation
  in v1 (see Phase 3).
- Not auto-sending outreach — output is a scored candidate that enters
  the same human-in-the-loop enrichment/draft flow AIGTM already has.
- Not real-time — quarterly/annual filings are an inherently lagging
  indicator; that trade-off is accepted in exchange for reliability and
  legitimacy of source.

## 4. Users

Internal only: Cloudculate's GTM/BD user(s), the same single-admin
audience as the rest of AIGTM. No external or multi-tenant use.

## 5. Assumed integrations

This PRD assumes the following are available and slots each into the
existing pipeline rather than reimplementing equivalent functionality:

- **HubSpot** — CRM sync target for candidates surfaced by this source.
  (`docs/SCOPE.md` currently lists HubSpot as paused pending a plan
  upgrade; this PRD assumes it's reinstated by build time. If it isn't,
  ship with Sync deferred rather than blocking the rest of the
  pipeline.)
- **Apollo** — primary enrichment provider: resolves a filer
  (ticker/CIK/company name) to firmographic data and a contact
  waterfall (domain, employee count, industry, named contacts).
- **LinkedIn + LinkedIn Sales Navigator** — decision-maker
  identification and verification only: confirm the current
  CIO/CTO/VP Infrastructure/IT Director for a flagged company, and
  their title/tenure. Research use only — no auto-connect requests, no
  auto-InMail. AIGTM's no-unsupervised-send policy (`docs/SECURITY.md`)
  applies here exactly as it does to Gmail.
- **Syft** — supplementary structured filings/financial-data source.
  Where Syft has already parsed a filing into structured financial
  statements, prefer its structured output over re-parsing raw EDGAR
  HTML/XBRL for that filing; fall back to direct EDGAR parsing where
  Syft doesn't cover a given filer. SEC EDGAR stays the source of
  record for "did this filing exist and what does it say" — Syft is a
  parsing accelerator, not a replacement data source.
- **Knock-ai** — notification/alerting layer. Replaces a bespoke
  Slack-webhook alert with a proper notification service: one
  qualified-hit event fans out to Slack (and later email or other
  channels, if wanted) with per-user preferences and delivery tracking,
  instead of AIGTM hand-rolling multi-channel alerting.

None of these change the human-in-the-loop principle in §3/§9: every
integration above is read (enrich/research) or notify — none is a
channel for autonomous outreach.

## 6. What counts as a signal

A passage qualifies if it describes the company **itself** doing one of:

- Committing capex/opex to new infrastructure: data center builds or
  exits, cloud migration ("moving to AWS/Azure/GCP", "cloud-first
  strategy"), colocation changes.
- Platform replatforming: ERP replacement (SAP, Oracle, Workday
  migrations), core banking/claims/PMS system overhauls, legacy system
  modernization.
- New IT leadership or org signals correlated with infra change: newly
  appointed CIO/CTO/VP Infrastructure with a stated mandate, a
  newly disclosed IT restructuring.
- Security/compliance-driven infra investment: post-breach
  remediation, new SOC2/FedRAMP/PCI infrastructure buildout,
  zero-trust network initiatives.
- M&A/divestiture-driven IT integration or carve-out ("integrating
  acquired company's systems", "standing up standalone IT
  infrastructure post-spinoff").
- Explicit forward-looking statements naming a budget, timeline, or
  vendor RFP for any of the above.

Passages that only mention "digital transformation" or "technology
investment" as boilerplate with no concrete action, budget, or system
named are treated as **weak** signal and scored lower, not discarded —
useful for building a "getting warmer" watchlist without triggering
outreach.

## 7. Pipeline (v1 scope: US SEC filers)

1. **Ingest** — SEC EDGAR full-text search API + filing index for
   10-K, 10-Q, and 8-K (Item 2.01 acquisitions / Item 1.01 material
   agreements often carry IT vendor contracts). Poll daily against
   EDGAR's "filings since" feed; no scraping of non-public sources.
   Where **Syft** already has a filer's statements structured, pull
   from there instead of re-parsing EDGAR's raw HTML/XBRL for that
   filing.
2. **Parse** — extract plain text from the filing; chunk by section
   (MD&A, Risk Factors, Business Overview are highest-yield sections —
   skip financial statement tables).
3. **Extract** — LLM pass over each chunk classifies against the
   signal taxonomy in §6, extracting: signal type, quoted passage,
   confidence, and any named system/vendor/budget/timeline mentioned.
   This is the same "untrusted content → structured extraction, no
   autonomous action" pattern AIGTM already uses for enrichment (see
   `docs/SECURITY.md`'s prompt-injection note) — filing text is
   adversarial-content-safe by construction (SEC-filed, attributable,
   legally liable statements) but the extraction step still only
   produces structured data, never a direct action.
4. **Score** — combine signal strength, recency, and company
   firmographic fit (size, industry) into a single score, reusing
   AIGTM's existing ICP rules engine rather than building a second
   scoring system.
5. **Enrich** — resolve the filer to a company record via **Apollo**
   (ticker/CIK/company name → domain, firmographic data, contact
   waterfall), then confirm the right contact — CIO/VP
   Infrastructure/IT Director — and their current title/tenure via
   **LinkedIn / Sales Navigator** where Apollo's contact data is stale
   or missing.
6. **Sync** — write the candidate into **HubSpot** as a company/contact
   record tagged with source = `filing-scan`, alongside the existing
   lead pipeline, exactly like any other AIGTM source.
7. **Alert** — fire a qualified-hit notification through **Knock-ai**
   (fanning out to Slack today, other channels later) with the quoted
   filing passage and a link to the source document, so a human can
   verify the signal before any outreach draft is created.

No new outreach or scoring UI is required — this is purely a new
producer into the existing consumer pipeline, which is why it belongs
in AIGTM rather than as a standalone tool.

## 8. Phases

**Phase 1 (MVP)** — US SEC EDGAR only (10-K/10-Q/8-K), full-text-search
indexed filers (thousands of companies, updated daily by EDGAR itself).
Rules+LLM extraction against the §6 taxonomy. Feeds existing pipeline.
Manual precision review loop: GTM user marks each surfaced hit
relevant/not in the dashboard, feeding back into extraction-prompt and
scoring tuning.

**Phase 2** — Add earnings call transcripts and investor
presentations (where a company publishes them on its own IR site) as a
faster-cadence source than annual/quarterly filings, and add 8-K Item
2.01/1.01 as a near-real-time trigger rather than waiting for the next
10-Q.

**Phase 3** — Extend beyond SEC filers: annual reports from
international/private companies that voluntarily publish them (investor
relations PDFs), subject to a legal check that the source is public and
scraping is not prohibited by the publishing site's terms.

## 9. Success criteria / how we'll know it's working

- Phase 1 ships extraction + scoring covering a pilot set of
  target industries (defined with the GTM user before build) and
  produces at least one week of continuous daily EDGAR ingestion
  without manual intervention.
- GTM user reviews a sample of surfaced hits; ≥60% rated relevant
  (a real IT infra initiative, correctly attributed) before Phase 2
  work starts. Below that, tune the taxonomy/prompt before adding
  sources.
- Zero outreach sent without human approval, consistent with AIGTM's
  existing human-in-the-loop model.

## 10. Open questions for the GTM user before build starts

- Target industries/company-size band for the Phase 1 pilot (affects
  EDGAR filer volume and expected hit rate).
- Whether 8-K M&A items should be in Phase 1 or held for Phase 2 —
  they're higher-signal but noisier to parse than 10-K/10-Q narrative
  sections.
- Whether a "getting warmer" weak-signal watchlist (§6) is wanted in
  v1 dashboard, or if only high-confidence hits should surface at all
  initially.
- Whether the HubSpot Sync step (§7) should block Phase 1 launch if
  HubSpot isn't reinstated by then, or ship with Sync deferred and
  candidates surfaced via Knock-ai/Slack alone in the interim.
