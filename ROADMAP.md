# Zapier beliq connector - implementation roadmap

`status: live, next: [operator] pass 2's in-product check on 1.0.2 (pushed 2026-09-26): branding, connect an account, run each create in a Zap`

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
  (JSON), optional `pdfTemplateId`, `verify` on by default. XML output returns
  the XML text + schematron/envelope metadata; PDF output stashes a File.
  `profile` applies to the ZUGFeRD / Factur-X family only: XRechnung and Peppol
  BIS pin their own, so the create drops a profile the resolved standard
  rejects rather than sending a guaranteed 422. For those two standards a PDF is
  a visualization with no XML inside it, and the request asks for a rendered
  visual, without which the API refuses PDF output.
- **Validate / Parse / Convert**: a document from `documentText` (pasted XML) or
  `documentFile` (a hydrated file pointer, fetched via `z.request`). Validate and
  Parse return the result JSON. Convert stashes the converted File and passes
  `lostElementsCount` / `lostElements` through.

---

## 2. Passes

### Pass 1 - Local integration code + tests (done)

Four rounds of changes landed on top of the original build, all of them local
code still inside this pass: the NLCIUS generate target and `@beliq/sdk` 0.2.0;
the per-standard profile gating and `verify` on by default; PDF output on
XRechnung and Peppol BIS; valid GS1 check digits on the prefilled invoice's
Peppol ids. All of it ships as Zapier version `1.0.0`, the first number the
platform accepts: Zapier requires a contiguous version chain, so `X.Y.Z` is
rejected unless its predecessor already exists there. `CHANGELOG.md` records
what `1.0.0` contains. The package stays unpublished to npm, since Zapier
distributes through its own platform.

The original build:

- package.json (MIT, name `zapier-beliq`, exact `zapier-platform-core` pin,
  `@beliq/sdk` dependency, `scrub:check`), tsconfig, vitest.config, .gitignore,
  renovate, LICENSE.
- src/lib/client.ts (createClient/mapError/asJsonObject), src/lib/io.ts
  (resolveDocument/stashDocument), src/lib/options.ts (LIVE_* -> choices),
  src/lib/samples.ts.
- src/authentication.ts (apiKey + /v1/me test), src/index.ts (App, no auth
  middleware since the SDK injects auth).
- src/creates/{generateInvoice,validateInvoice,parseInvoice,convertInvoice}.ts.
- test/mapping.test.ts + test/sample-invoice.test.ts (unit, recording fetch
  injected into the SDK; 17 pass offline) + test/creates.test.ts (live smoke,
  gated on BELIQ_API_KEY, 5 tests).
- README, this ROADMAP, CHANGELOG.
- Verified: `npm run build` clean, `npm test` green, `npm run scrub:check` clean,
  `npm run validate` structurally sound (25 checks passed, 0 errors, 0 failed, 0
  publishing warnings). Three general (non-blocking) warnings, two by design:
  - D004 on `generate_invoice.pdfTemplateId`: it looks like an ID field but has
    no dynamic dropdown. beliq exposes no list-templates endpoint, so a dropdown
    is impossible; reach a template by pasting its ID.
  - D003 connectionLabel: no label is set on purpose (reviewer rule 5.6 forbids
    the app name in the label, and beliq has no other stable per-account value
    worth showing). Zapier auto-numbers connections.
  - D027 asked for `zapier-platform-core` 19.1.0 against the pinned 19.0.0.
    Closed 2026-09-21 by #17, which moved the exact pin to 19.1.0; see §5.

### Pass 2 - Register + push + in-product verification (partly done)

Registered and pushed 2026-09-15. Integration `beliq`, id `246379`, key
`App246379`, audience global, role employee, category invoices, homepage
`https://beliq.eu`, description "beliq is an e-invoicing API that generates,
validates, parses and converts EU invoices: XRechnung, ZUGFeRD, Factur-X and
Peppol BIS." `.zapierapprc` is committed. Version `1.0.0` was pushed on
2026-09-15 and `validate` reported 25 checks passed, 0 errors, 0 publishing
warnings.

`1.0.1` was pushed 2026-09-24 00:21 Berlin by beliq-hq `CONNECTORS-ROADMAP.md`
sub-pass 8b (the NLCIUS Output help text). Both versions are `private` with no
Zap users. `1.0.2` was pushed 2026-09-26 by beliq-hq's 8f pass 1 landing, from
zapier-beliq#28 (the fixes) and #29 (the release), also `private`.

Pass 3's promotion (making the integration public) waits for beliq-hq's
API-stability gate, decided 2026-09-26: beta exit, or 4 straight weeks with no
breaking change to the `/v1` operations the connectors call. See
`CONNECTORS-ROADMAP.md`, "Store listings wait for a stable API".

Pass 2 is signed off on `1.0.2`, not `1.0.1`: it is the version Pass 3
promotes, and its PDF output-field samples (R97 in zapier-beliq#28) can only be
seen there. Branding does not depend on the version and can happen any time.

Remaining, all of it in a browser at `https://developer.zapier.com` and the Zap
editor. Use a `blq_test_` key from your own beliq organization, never the shared
connector CI organization's key: that key should not be stored in Zapier, and
the sandbox allowance is metered per organization
(`beliq-types/src/pricing.ts:82`), so a CI key would spend the allowance the
connector repos' `live` jobs run on.

1. Branding: upload `assets/beliq-logo-1024.png` (1024x1024 PNG) and set the
   brand color `#fe6019`. There is no CLI for either.
2. Connect a beliq account. A valid key passes the test (`GET /v1/me`). A wrong
   key is refused with "The beliq API key is invalid."
3. Generate Invoice, Output XML, with the prefilled invoice: returns `xml`,
   `schematronVersion` and `outputEnvelope`.
4. Generate Invoice, Output PDF: before the test run, the Zap editor already
   shows File, Filename, Size (bytes) and PDF Kind with sample values (R97).
   After it, `file` opens as a PDF in a downstream step (email attachment or
   file upload) and `pdfKind` is `hybrid` or `visualization`.
5. Validate Invoice on the XML from step 3: `valid` is true.
6. Parse Invoice on the same XML: returns `format` and the `invoice` fields
   (number, issue date, currency, gross total).
7. Convert Invoice on the same XML: `file` opens in a downstream step, and
   `lostElementsCount` is present.
8. Turn one of these Zaps on, then run `npx zapier-platform versions` in this
   repo. Expected: `1.0.2` shows 1 Zap user, which proves a live Zap sits on the
   new version. The count lags; re-run after about 10 seconds. A step only
   tested in the editor probably does not count.
9. `npx zapier-platform logs` shows the runs. It lists `z.request` traffic only
   (the credential test and file hydration), not the SDK's calls; see §0.

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
- `zapier-platform validate` runs Zapier's server-side integration checks with
  no login. Without `~/.zapierrc` (or without `.zapierapprc`), zapier-platform-cli
  19.1.0 posts the app definition to Zapier's check endpoint anonymously
  (`validateApp` in `src/utils/api.js`). That is the run CI gets: 26 checks in
  the `test` job of https://github.com/beliq-eu/zapier-beliq/actions/runs/35798156755
  (2026-09-23). Logged in with the linked app, the same command also runs the
  app-level checks (38 checks on 2026-09-15, 40 on 2026-09-21).
- `npm run validate` is `scripts/validate-gate.sh`, not the bare CLI. The CLI
  exits non-zero only for a schema error; a failed integration check (blocks
  `push`) or a publishing task (blocks `promote`) is printed and it still exits
  0 (`src/oclif/commands/validate.js`). The gate reads the CLI's summary counts,
  fails on either, and fails when it cannot read them. General warnings, such as
  D003 and D004, pass.
- Tests are type-checked: `npm run typecheck` runs `tsc` over `src/` and `test/`
  with `tsconfig.test.json`, and CI runs it. `tsconfig.json` still excludes
  `test/`, because its `rootDir: src` shapes the `dist/` build.
- Generate has one operation `sample`, the XML shape. The keys only PDF output
  returns (`file`, `filename`, `sizeBytes`, `pdfKind`) carry their sample on
  their own output field, which Zapier merges into the operation sample.

## 4. Open questions / known unknowns

- Whether to add conditional field display for documentFile vs documentText, vs
  the current show-both + perform-side resolution. Current approach is robust.

## 5. Dependency state, measured 2026-09-21

Re-homed from `beliq-hq/STATUS-CONVENTION-ROADMAP.md`'s parked backlog in pass 8a-2. Both items
were parked there because they are code changes rather than roadmap defects, and a stamping pass
does not own a code change. They belong here.

**`zapier-platform-core` was pinned to 19.0.0 while 19.1.0 was current, and #17 closed that gap
on 2026-09-21.** `npm view zapier-platform-core version` returned 19.1.0 on 2026-09-21, and at the
time of measuring `npm run validate` reported the gap as D027 alongside the two warnings § *Pass 1*
keeps by design.

**The reason this sat open was measured wrong, and the correction is worth keeping.** It was
recorded as "`validate` requires an exact pin, so Renovate cannot float it and the bump is a hand
edit". Renovate *can* bump an exact pin to another exact pin, and it already has:
[#17](https://github.com/beliq-eu/zapier-beliq/pull/17) carries
`"zapier-platform-core": "19.1.0"`, correctly pinned, beside `@beliq/sdk` `^0.4.0`. What Renovate
could not do is the **lockfile** (`renovate/artifacts`: "Artifact file update failure"), so `npm ci`
refused the manifest/lock mismatch, the install step failed and every later step skipped. The PR
read as a failing test run with nothing tested. So the blocker was never the pin, and a hand edit
was never needed.

Regenerated the lockfile on that branch on 2026-09-21 and verified the full CI sequence locally
against a clean `node_modules`: `npm ci` succeeds, `tsc` succeeds, `npm run validate` reports **40
checks passed, 0 errors and no D027**, leaving only D004 and D003, `vitest run` passes 22 of 22 and
`scrub:check` is clean. D027 closed when #17 merged on 2026-09-21.

**Four open Dependabot alerts, all development scope.** Measured against the API on 2026-09-21:

| # | Severity | Package | Advisory |
|---|---|---|---|
| 29 | high | `browserslist` | `GHSA-73wf-gq98-2v4g` |
| 33 | medium | `vitest` | `GHSA-82fw-gwwq-j7x9` |
| 32 | medium | `@vitest/mocker` | `GHSA-82fw-gwwq-j7x9` |
| 34 | medium | `baseline-browser-mapping` | `GHSA-w5vr-8v7q-w6rv` |

Every one carries `scope: development` and sits in `package-lock.json`. None reaches the published
connector, which stays SDK-thin: `@beliq/sdk` and `zapier-platform-core` are the only runtime
dependencies. The parked entry recorded **one** alert here when it was written; it is four now, and
this repo had already cleared its alerts once (#4, 2026-08-08), so these are new rather than
untouched.

**Re-read 2026-09-25: two are still open**, #29 (`browserslist`, high) and #34
(`baseline-browser-mapping`, medium), both still development scope. #32 and #33 closed with #18.
beliq-hq `CONNECTORS-ROADMAP.md` item 8 tracks the remaining two across the connector repos, so they
are not re-planned here.

**The gap was merging, not noticing, and the queue cleared on 2026-09-21.** Renovate had already
proposed the fixes and they were still sitting open when this was measured:
[#18](https://github.com/beliq-eu/zapier-beliq/pull/18) (`vitest` to v4.1.11, security, proposed
2026-09-13, merged 2026-09-21), [#17](https://github.com/beliq-eu/zapier-beliq/pull/17) (minor
dependency updates, proposed 2026-09-07, merged 2026-09-21) and
[#16](https://github.com/beliq-eu/zapier-beliq/pull/16) (`@types/node`, proposed 2026-09-07, merged
2026-09-21).
At the time, `renovate.json` extended the plain `local>beliq-eu/.github` preset rather than the
automerge variant, so nothing landed without a human, and the cost of that design was exactly this
queue. [#24](https://github.com/beliq-eu/zapier-beliq/pull/24) moved it to
`local>beliq-eu/.github:automerge` on 2026-09-22, which merges patch and digest updates by itself
once CI is green.

**Renovate cannot update this repo's lockfile, and that is why the queue does not clear itself.**
#17 arrived as a `package.json`-only change with `renovate/artifacts` failing; CI runs `npm ci`,
which refuses a manifest/lock mismatch at the install step, so the PR presents as a failing test
run with nothing tested. A reviewer reading the check names sees `test fail` and concludes the
dependency broke something. It did not. Fixed by hand on #17's branch on 2026-09-21. The
expectation was that **the next Renovate PR touching a dependency will land the same way** until
the lockfile half is solved. [[bq-renovate-lockfile]] records the same shape on the yarn siblings.

**Unverified since 2026-09-21: no Renovate PR has arrived here since #16, #17 and #18**, so whether
the lockfile update still fails is not known. The next Renovate PR that changes `package.json`
settles it: a green `renovate/artifacts` check and a `package-lock.json` in its diff mean it is
fixed. With `:automerge` a green patch PR now merges by itself, but one whose lockfile update fails
also fails `npm ci`, so it stays open instead of landing broken.

## 6. Parked / out of scope

- beliq-hq `CONNECTORS-ROADMAP.md`, "Sub-pass 8f", "Parked by 8f" owns two small zapier items: the
  `1.0.1` `source.zip` on Zapier carries a `.git` pointer file with a local absolute path, because
  the 8b script pushed from a worktree (`1.0.2` replaces it as the newest version); and
  `test/sample-invoice.test.ts` and `test/integration.test.ts` still use `any`. Tracked there, not
  copied here.
- `CHANGELOG.md` dates `1.0.1` as 2026-09-23, but it was merged at 00:20 and pushed at 00:21 Berlin on
  2026-09-24. Not fixed yet: zapier-beliq#29 adds the `1.0.2` entry directly above that heading, so
  an edit there now could conflict with it. xs, after zapier-beliq#29 merges.
