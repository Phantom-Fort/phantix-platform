# Newly Provisioned Endpoints — Frontend Integration Guide

**Audience:** Phantix platform + staff portal frontends wiring the newly
provisioned backend endpoints (SOC enhancement, Integrations Hub, Branch
Reviewer, advisor, cloud integrations, SSO/SCIM).

**Companion docs:**
- Route truth: `API_ENDPOINT_CATALOG.md` (live route dump) · staff OpenAPI
  `GET /api/v1/staff/docs/openapi.json` (staff JWT) — schema source of truth.
- Design/contracts (product): external `FE-DOCS/SOC Enhancement/` docs
  `05`–`09`/`11` + appendices; `FE-DOCS/SOC & IR` seeds; repo
  `INTEGRATIONS_HUB_DESIGN.md`, `HANDOFF_INTEGRATIONS_AND_BRANCH_REVIEWER.md`,
  `BRANCH_*` FE docs, `docs/SOC_ENHANCEMENT_IMPLEMENTATION_STATUS.md`.
- All paths below are relative to `{API_BASE}/api/v1`.

---

## 1. Conventions & auth

| Caller | Auth | Header |
|--------|------|--------|
| Org user / company portal (default) | Org JWT | `Authorization: Bearer <org_user|access token>` |
| Host agent / machine (logs, agents, cloud ingest) | Org service key | `X-Org-Api-Key: <pk_live_…>` |
| Webhook mapper (Hub inbound) | HMAC | `X-Phantix-Signature: sha256=<hex>` |
| OAuth/SSO public callbacks | none (state) | — |
| SCIM 2.0 | SCIM bearer (Hub-minted) | `Authorization: Bearer <scim-token>` |
| Staff-only authoring/seeds | Staff JWT | `Authorization: Bearer <staff>` + `?organization_id=` |

- **JSON casing:** all endpoints in this guide are **snake_case**.
  Exception: legacy SOC surfaces (`GET /soc/dashboard`, availability,
  some cases) still use camelCase envelope keys (`organizationId`). When in
  doubt use the schema of each call.
- **Feature flags:** Hub endpoints/catalog 404 unless `INTEGRATIONS_HUB_ENABLED`;
  SOC feature sets gate on `PHANTIX_SOC_LOG_INGESTION_ENABLED`,
  `PHANTIX_SOC_PLAYBOOKS_ENABLED`, `PHANTIX_SOC_ADVISOR_ENABLED`,
  `PHANTIX_SOC_CLOUD_ADAPTERS_ENABLED` (dev defaults off — set on in staging).
- **Dual control:** mutating org routes require an operate session
  (`X-Dual-Control-Session`). Paths marked *pending* return `202`
  (`AuditPendingAction`) for the initiator and execute after an authorizer
  approves via the audit inbox (`/api/v1/audit/pending`).
- **Errors:** `{detail: {code, message}}` (Hub/SOC services) or
  `{message, code}` — plus HTTP 402 `integration_pack_required` on entitlement
  misses, 409 when the org security DB isn't bootstrapped.

---

## 2. Route map (new)

Legend: 🔐 org JWT · 🤖 service key · 🌐 public · ⭐ staff (+`organization_id` query)

### 2.1 SOC — log pipeline & agents

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/soc/agents/register` | 🤖 | register host agent; returns `agent_id`, token, server config overrides |
| POST | `/soc/agents/heartbeat` | 🤖 | agent liveness (`mode_health`) |
| POST | `/soc/logs/ingest` | 🤖 | chain-hashed log batch (`entries[]`, `hash`) |
| POST | `/soc/logs/filebeat` | 🤖 | ECS/Filebeat events (synthetic batch) |
| POST | `/soc/logs/cloud` | 🤖 | provider-native cloud events → normalized+ingested |
| POST | `/soc/logs/search` | 🔐 | search `server_logs` (q/host/facility/level/time) |
| GET | `/soc/logs/stats` | 🔐 | 24h pipeline stats (level/facility/host, error %) |

### 2.2 SOC — playbooks / runbooks / MITRE provisioning (`/soc/provisioning`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/playbooks` | 🔐 | catalog (filters `category,mitre_id,severity,enabled,org_only`, limit/offset) |
| GET | `/playbooks/{id}` | 🔐 | detail w/ full phases |
| POST | `/playbooks` | 🔐* | create custom / org override (202 pending) |
| PATCH | `/playbooks/{id}` | 🔐 | update (needs `version` — optimistic lock) |
| DELETE | `/playbooks/{id}` | 🔐 | delete custom / clear override |
| POST | `/playbooks/suggest` | 🔐 | score catalog against a detection |
| GET | `/runbooks` · `/runbooks/{id}` | 🔐 | list/detail |
| POST · PATCH · DELETE | `/runbooks[/{id}]` | 🔐 | manage runbook templates |
| GET | `/mitre/techniques[?tactic&q]` | 🔐 | technique catalog (+`tactics_summary`) |
| GET | `/mitre/techniques/{id}` | 🔐 | technique detail w/ mapped playbooks |
| GET | `/mitre/matrix` · `/mitre/stats` | 🔐 | coverage matrix / gap analysis |
| POST | `/playbooks/seed` · `/runbooks/seed` · `/mitre/seed` · `/bulk/seed-all` | ⭐ | idempotent seed of global catalogs (50 playbooks / 95 techniques / 10 runbooks) |
| POST | `/mitre/techniques` | ⭐ | add/update technique mapping |

### 2.3 SOC — enhanced war room (`/soc/war-room`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/soc/war-room` | cases + DB playbook catalog + per-case phase progress |
| POST | `/soc/war-room` | open case; `playbookId` pre-fills `war_room_phases` checklist |
| GET | `/{case_id}` | detail + checklist |
| GET | `/{case_id}/checklist` | phase groups, current phase, progress |
| PATCH | `/{case_id}/checklist/{step_id}` | step status (`completed/skipped/…`, `completed_by`, `notes`) → auto-advance + SLA events |
| GET | `/{case_id}/evidence` | merged timeline (detections, logs, incidents, steps) |
| POST | `/{case_id}/evidence-link` | link a `server_log_id` to the case |
| GET | `/{case_id}/kill-chain` · `/mitre` | MITRE tactic chain / technique detail per case |
| GET | `/{case_id}/sla` | per-metric targets vs actual, breached list |
| GET | `/{case_id}/timeline` | chronological case stream |
| GET | `/soc/war-room/stream` | SSE live events (case/phase/SLA) |

### 2.4 SOC — dashboard / reports / advisor

| Method | Path | Purpose |
|---|---|---|
| GET | `/soc/dashboard/mitre-matrix` | technique coverage matrix + detections/cases |
| GET | `/soc/dashboard/sla` | SLA compliance aggregates (30 d) |
| GET | `/soc/dashboard/agents` | agent fleet health (active/stale/offline, versions) |
| GET | `/soc/dashboard/log-pipeline` | log totals/rates/error % |
| GET | `/soc/dashboard/cases-summary` | open cases, by severity/playbook, oldest |
| GET | `/soc/dashboard/war-room-stats` | incident + playbook progress tiles |
| GET | `/soc/reports/weekly?week=2026-W36` | weekly SOC JSON report |
| GET | `/soc/advisor/dashboard` · `/trends` · `/benchmarks` | advisor overview |
| GET | `/soc/advisor/readiness/{framework}` | per-framework control coverage |
| GET | `/soc/advisor/recommendations` | open recommendations (filter `status`, `priority`) |
| PATCH | `/soc/advisor/recommendations/{id}` | resolve/accept/reject (+assignee, notes) |
| POST | `/soc/advisor/reports/generate` | generate report (see §3.6) |
| GET | `/soc/advisor/reports` · `/{id}` | list / detail w/ recommendations |
| POST | `/{id}/publish` · DELETE `/{id}` | review-publish / delete |
| GET | `/{id}/download.{fmt}` | `md`/`json` download (html/pdf/pptx → 501; via Reporting Engine) |

### 2.5 SOC — cloud provider integrations (`/soc/provisioning/cloud`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/catalog` | provider catalog + setup templates (IAM policies/roles) |
| POST | `/connect` | create connection (`provider,integration_type,display_name,config`) |
| GET/PATCH/DELETE | `/connections[/{id}]` | manage connections |
| GET | `/{id}/status` | health + setup reminder |
| GET | `/{id}/discover` | configured log sources / discovered signals |
| POST | `/{id}/sync?minutes=` | sync (webhook deliveries counted; SDK pulls worker-scoped) |

### 2.6 Integrations Hub (`/integrations`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/catalog` · `/catalog/{connector_id}` | 🔐 | connector metadata (auth modes, wave, status) |
| GET | `/installations` | 🔐 | Hub rows **merged** with legacy bridges (WA/TG/email, `cloud.*`) |
| POST | `/installations` | 🔐*pending | install (assert packs; `pending_auth` for oauth/oidc) |
| GET/PATCH | `/installations/{id}` | 🔐 | read / update config |
| DELETE | `/installations/{id}` | 🔐*pending | disconnect |
| POST | `/{id}/oauth/start` | 🔐 | start OAuth install (row must be `pending_auth`) → `{authorize_url,state}` |
| GET/POST | `/oauth/{connector_id}/callback` | 🌐 | IdP redirect (single-use state) |
| POST | `/{id}/rotate-secret` | 🔐*pending | rotate webhook/API secret (raw once) |
| POST | `/{id}/scim-token` | 🔐*pending | mint SCIM bearer (raw once) |
| POST | `/{id}/send-event` | 🔐 | n8n/Zapier outbound signed event |
| POST | `/{id}/test` | 🔐 | health probe |
| POST | `/hooks/{public_id}` | HMAC | inbound mapper → SOC fan-out |

### 2.7 SSO OIDC + SCIM (`/integrations/sso`, `/scim/v2`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/integrations/sso/{org_slug}/start` 🌐 | 302 → IdP authorize |
| GET/POST | `.../sso/{org_slug}/callback` 🌐 | returns token to browser (see §3.3) |
| GET | `/scim/v2/ServiceProviderConfig` | capability doc |
| GET/POST | `/scim/v2/Users` | list (filter `userName eq`) / provision |
| GET/PATCH/DELETE | `/scim/v2/Users/{id}` | read / (re)activate / soft-deactivate |

### 2.8 Branch Security Reviewer (GitHub)

| Method | Path | Purpose |
|---|---|---|
| GET/PUT | `/github/repositories/{id}/review-settings` | per-repo watched branch (PUT pending) |
| GET | `/github/branch-reviews/settings` | all org repo configs |
| GET | `/github/branch-reviews/wallet` | prepaid NGN wallet |
| POST | `/github/branch-reviews/wallet/top-up` | Paystack top-up init |

---

## 3. Flows to wire

### 3.1 Slack (OAuth) install — end to end

1. `POST /integrations/installations` `{connector_id:"slack",auth_mode:"oauth2",label:"default"}`
   → initiator gets **202 pending**; after authorizer approval the row is
   created with `status:"pending_auth"` (watch via `GET /installations/{id}`).
2. `POST /installations/{id}/oauth/start` → `{authorize_url, state}`; open in a
   popup (backend validates operate session).
3. IdP redirects to `GET /integrations/oauth/slack/callback` (public). Backend
   stores tokens; installation becomes `status:"active"`.
4. `POST /installations/{id}/test`; then configure alerts:
   `PUT /alerts/settings` channel_policy includes `slack` for critical+high.
   Slack/Teams deliveries resolve through the projection only while
   `INTEGRATIONS_HUB_ENABLED` is on.

### 3.2 Teams / webhook-style installs

`POST /installations` with `auth_mode:"copy_webhook"` and pass the URL in the
**`secrets` field**: `{"secrets":{"webhook_url":"https://…webhook.office.com/…"}}`
(it is never echoed in `config`). Row is `active` immediately; optionally
`POST /installations/{id}/rotate-secret`.

### 3.3 OIDC SSO login (web)

1. User clicks login → `GET /integrations/sso/{org_slug}/start` → IdP.
2. Callback `GET /integrations/sso/{org_slug}/callback` returns an HTML page
   that (a) `postMessage({type:"phantix:sso", payload})` to `window.opener`,
   and (b) writes `phantix:sso` to `sessionStorage` and redirects to
   `{origin}/app`. `payload = {token, token_type:"bearer", realm:"organization_user",
   organization_id, email, role, full_name}`.
3. Use `token` as the org-user Bearer. IdP MFA is trusted (no Phantix OTP);
   sensitive operate still needs the dual-control OTP session.
- Configure IdP under `POST /integrations/installations`
  `{connector_id:"entra_oidc"|"okta_oidc"|"google_oidc", auth_mode:"oidc",
  config:{issuer, client_id, role_default?}, secrets:{client_secret}}` — one
  active IdP per org.

### 3.4 Webhook mapper (Hub inbound)

1. Install `webhook_mapper` (`auth_mode:"webhook_secret"`, e.g. with
   `secrets.webhook_secret` or rotate later). `public_id` is returned.
2. Show the customer: `POST {API_BASE}/api/v1/integrations/hooks/{public_id}`
   with header `X-Phantix-Signature: sha256=<hex of body>` (HMAC-SHA256) and
   JSON body `{title, severity, summary, host, event_kind, ...}`.
3. Success → `{ok:true, installation_id, result}`; mapper fan-out creates SOC
   signals via the shadow connector.

### 3.5 War room

Open `POST /soc/war-room` `{title, severity, playbookId, detectionIds[]}` →
renders checklist from `GET /{case_id}/checklist`. Toggle steps via
`PATCH /{case_id}/checklist/{step_id}` `{status:"completed", completed_by,
notes}`; refresh `evidence`, `kill-chain`, `sla` tabs. SSE `GET /soc/war-room/stream`.

### 3.6 Advisor

`POST /soc/advisor/reports/generate` example:

```json
{
  "report_type": "posture",
  "include_threat_model": true,
  "format": "markdown"
}
```

Returns `{report_id, status:"draft", report_type, title, created_at}`. Poll
`GET /soc/advisor/reports/{id}` → `report_data.executive_summary` (LLM text when
configured), `score`, `recommendations[]`. Publish with
`POST .../{id}/publish?reviewed_by=…`.

### 3.7 Playbook override semantics (UI rule)

`POST /playbooks` with an `id` matching a global playbook **creates an org
override** (composite key `(id, organization_id)`). Editing an existing org row
must send `version` on `PATCH`; server rejects with 409 `version_conflict` on
mismatch. Global rows (`organization_id: 0`) are read-only from the org API.

---

## 4. Seed + readiness (staff/admin)

- `POST /soc/provisioning/bulk/seed-all?organization_id=<id>` seeds playbooks +
  runbooks + MITRE into an org's security DB (idempotent). Use after enabling
  `PHANTIX_SOC_PLAYBOOKS_ENABLED` or when an org's catalog is empty.
- Advisor framework coverage: `GET /soc/advisor/readiness/{framework}` where
  framework ∈ NIST CSF 2.0 | ISO 27001:2022 | POPIA | NDPR | PCI DSS v4.0 |
  SOC 2 | CIS Controls v8 | OWASP ASVS 4.0.

## 5. Alert severity floors (FE copy)

| Severity | email | WhatsApp/Telegram | Slack/Teams |
|---|---|---|---|
| critical | ✅ | ✅ | ✅ |
| high | ✅ | ❌ | ✅ |
| medium/low/info | ✅ | ❌ | ❌ |

Defaults live in `DEFAULT_CHANNEL_POLICY`; org `channel_policy` may only
narrow within `CHANNEL_SEVERITY_FLOOR` (e.g., it can never add WA/TG to high).
Update any channel-toggle UI accordingly.

---

## 6. Implementation notes for FE

1. **Backend schema source of truth:** Pydantic modules under
   `app/engines/soc_engine/schemas/`, `app/engines/control_plane/integrations/schemas.py`,
   `.../advisor/models/schemas.py`; regenerate clients from the staff OpenAPI.
2. **Pagination convention** (new SOC/Hub): `limit`/`offset` query params with
   `total`, `page`, `per_page` in responses.
3. **Secrets never return** except once: `rotate-secret`, `scim-token` and the
   `connect` shadow webhook secret responses. Treat `has_secrets` as boolean UI
   state.
4. **Flags in staging:** turn on `INTEGRATIONS_HUB_ENABLED` and the four
   `PHANTIX_SOC_*` flags before exercising Hub/cloud/advisor surfaces.
5. **Staff endpoints** require a staff token (login via
   `POST /api/v1/staff/login`) — org tokens are rejected there.
