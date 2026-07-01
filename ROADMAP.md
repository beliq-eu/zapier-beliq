# Zapier beliq connector - implementation roadmap

Living roadmap for the Zapier integration, a beliq clone of `zapier-polydoc`
backed by the published `@beliq/sdk`. Standalone repo at
`~/Projects/beliq/tools/zapier-beliq/`.

Status legend: todo / in progress / done

---

## 0. Decision record (why this shape)

Zapier is a published, review-gated CLI platform integration
(`zapier-platform-core`, Node 22).

| Decision | Choice | Why |
|---|---|---|
| Transport | **`@beliq/sdk` (SDK-thin), not a vendored request builder** | Every beliq connector drives the same tested wire format (raw-body upload, content-type sniff, the `{success,data,error}` envelope). Accepted tradeoff: the raw HTTP is inside the SDK, so it does **not** appear in Zapier's per-request logs (Zapier only logs `z.request` traffic, and the SDK uses its own fetch). The credential test and file hydration still go through `z.request`, so those remain visible. |
| Action modeling | **Four creates** (Generate, Validate, Parse, Convert) | Zapier surfaces each action in its picker. Four actions give four indexed App Directory pages, four Zap-template hooks, and matching SEO. |
| File output | **`z.stashFile` to a Zapier File URL** in a `file` output field | Zapier creates return JSON, never raw binary. Stashing makes a PDF/XML usable by downstream attach/upload steps. Generate-XML and Validate/Parse return JSON directly. |
| Auth model | **Single `apiKey` field, no sandbox** | beliq keys are environment-scoped in the dashboard, not toggled per request. The `/v1/*` surface is pure compute with no sandbox tier today, so there is no sandbox header to send. |
| Auth test | **`GET /v1/me` via the SDK** | Zero quota, returns account context, 401/403 means the key is invalid. A working test is mandatory for App Directory review. |
| Connection label | **None** | Reviewer rule 5.6: the label must not contain the app name, and beliq exposes no other stable per-account value worth showing. Zapier auto-numbers connections. |
| Publishing | **register -> push -> promote -> App Directory review** | Not npm-published (unlike the SDK and the n8n/Activepieces connectors). No OIDC/provenance here. |

No cross-repo dependency: the integration runs server-side on Zapier and calls
the public API, so no gateway/CORS change is needed.

### Free vs paid (the cost answer)

- Build + `validate` + unit/live tests: free (local tooling + a live key).
- `register` + `push` + private use + inviting testers: free.
- App Directory listing (going public): free, but human-review-gated.

---

## 1. Product model

beliq API surface used here: `GET /v1/me`, `POST /v1/generate`,
`POST /v1/validate`, `POST /v1/parse`, `POST /v1/convert`. Auth is
`X-API-Key: <key>` (the SDK sets it). Dropdown value-spaces come from the SDK's
`LIVE_*` constants, which are the public subset of the beliq coverage SSOT;
provisional formats stay out of the UI.

- **Generate Invoice**: `standard`, `profile`, `output` (xml/pdf), `invoice`
  (JSON), optional `pdfTemplateId`, optional `verify`. XML output returns the
  XML text + schematron/envelope metadata; PDF output stashes a File.
- **Validate / Parse / Convert**: a document from `documentText` (pasted XML) or
  `documentFile` (a hydrated file pointer, fetched via `z.request`). Validate and
  Parse return the result JSON. Convert stashes the converted File and passes
  `lostElementsCount` / `lostElements` through.

---

## 2. Passes

### Pass 1 - Local integration code + tests (done)
- package.json (MIT, name `zapier-beliq`, exact `zapier-platform-core` pin,
  `@beliq/sdk` dependency, `scrub:check`), tsconfig, vitest.config, .gitignore,
  renovate, LICENSE.
- src/lib/client.ts (createClient/mapError/asJsonObject), src/lib/io.ts
  (resolveDocument/stashDocument), src/lib/options.ts (LIVE_* -> choices),
  src/lib/samples.ts.
- src/authentication.ts (apiKey + /v1/me test), src/index.ts (App, no auth
  middleware since the SDK injects auth).
- src/creates/{generateInvoice,validateInvoice,parseInvoice,convertInvoice}.ts.
- test/mapping.test.ts (unit, recording fetch injected into the SDK) +
  test/creates.test.ts (live smoke, gated on BELIQ_API_KEY).
- README, this ROADMAP, CHANGELOG.
- Verified: `npm run build` clean, `npm test` green, `npm run scrub:check` clean,
  `npm run validate` structurally sound (0 errors, 0 failed, 0 publishing
  warnings). Two general (non-blocking) validate warnings remain by design:
  - D004 on `generate_invoice.pdfTemplateId`: it looks like an ID field but has
    no dynamic dropdown. beliq exposes no list-templates endpoint, so a dropdown
    is impossible; reach a template by pasting its ID.
  - D003 connectionLabel: no label is set on purpose (reviewer rule 5.6 forbids
    the app name in the label, and beliq has no other stable per-account value
    worth showing). Zapier auto-numbers connections.

### Pass 2 - Register + push + in-product verification (operator, needs Zapier login)
- `npm i -g zapier-platform-cli`; `zapier-platform login` (beliq dev account).
- `zapier-platform register "beliq"` (writes `.zapierapprc`).
- Branding in the dashboard: upload `assets/beliq-logo-1024.png` (1024x1024) +
  the beliq brand color + set the dashboard description to start "beliq is a"
  (never mention Zapier, reviewer rule M002).
- `zapier-platform push`; connect a beliq account (confirm the auth test passes,
  and fails on a wrong key).
- Run each create once end to end; confirm generated/converted Files arrive and
  open in a downstream step, and that Validate/Parse return the expected JSON.

### Pass 3 - Zap templates + App Directory submission (operator)
- Author Zap templates in the developer dashboard (one per action angle), for
  example: Sheets row -> Generate Invoice -> email the PDF; new file -> Validate
  Invoice -> branch on `valid`; webhook -> Convert Invoice -> upload.
- `zapier-platform promote <version>` and submit for App Directory review.
- Adoption gates (all on the promoted version): 3 distinct users with a live
  Zap, at least 1 live Zap per action, a successful live run per action, a
  connected account. Reviewer rules to honor: 5.6 (connection label has no app
  name; none is set), 5.8 (every action description starts with a third-person
  verb: Generates / Validates / Parses / Converts), M002 (dashboard/App Directory
  description starts "beliq is a" and never says "Zapier").

---

## 3. Gotchas honored

- No em-dashes in any user-facing text (labels, helpText, descriptions, README);
  enforced by `npm run scrub:check`.
- SDK-thin: only `@beliq/sdk` + `zapier-platform-core` at runtime; everything
  else is a devDependency. The SDK owns the wire format.
- Import from the main `@beliq/sdk` entry, never `@beliq/sdk/helpers`.
- The credential test uses `GET /v1/me` (zero quota) rather than a paid call.
- `documentFile` is fetched with `z.request({ raw: true })` then `res.buffer()`;
  `documentText` is used otherwise; neither present is a clear input error.
- Generate defaults and the live smoke invoice are EN 16931-valid (dueDate,
  seller taxId for VAT category S, net + tax = gross, taxSummary) so they 200
  rather than 422.
- `zapier-platform-core` pinned to an exact version (validate requires it).

## 4. Open questions / known unknowns

- Server-side `zapier-platform validate` needs a Zapier login. Local schema
  validation against `zapier-platform-schema` is a stand-in until then; the full
  conformance check runs at Pass 2.
- Whether to add conditional field display for documentFile vs documentText, vs
  the current show-both + perform-side resolution. Current approach is robust.
- The final beliq brand color and the 1024x1024 logo for the branding step.
