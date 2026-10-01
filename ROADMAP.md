# Zapier beliq connector - implementation roadmap

`status: live, next: Pass 3, which waits for beliq-hq's API-stability gate ("Store listings wait for a stable API" in CONNECTORS-ROADMAP.md); Pass 2's in-product check passed on 1.0.2 on 2026-10-01`

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

### Pass 2 - Register + push + in-product verification (done 2026-10-01)

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

The in-product check ran on `1.0.2` on 2026-09-30 and 2026-10-01 (Berlin), in
the developer dashboard and the Zap editor, with a `blq_test_` key from the
operator's own beliq organization. Never use the shared connector CI
organization's key here: it should not be stored in Zapier, and the sandbox
allowance is metered per organization (`beliq-types/src/pricing.ts:82`), so a
CI key would spend the allowance the connector repos' `live` jobs run on. The
test Zap ran Schedule by Zapier, then Generate XML, Validate, Parse and Convert
on the XML, then Generate PDF, then Email by Zapier.

| # | Check | Observed |
|---|---|---|
| 1 | Branding | The logo was already uploaded and matches `assets/beliq-logo-1024.png`. The brand color is not in Integration Settings: it is "Primary color" in Publishing > App details, a section of the App Directory submission form that saves on its own and submits nothing. Saved there as `#fe6019`, with "publicly launched" Yes, "replacement for an existing integration" No, "already managing a public integration on the same API" No, homepage `https://beliq.eu`, API docs `https://docs.beliq.eu`. |
| 2 | Connect | The operator connected a key; the account shows as "beliq (1.0.2)", auto-numbered, no label. A wrong value entered first was refused with "The beliq API key is invalid.", thrown in `src/authentication.ts:14` on a 401/403. No test under `test/` asserts that message. |
| 3 | Generate, XML | XRechnung CII sandbox specimen for `INV-2026-001`, with `contentType` `application/xml`, `schematronVersion` `1.3.16` and `outputEnvelope`. |
| 4 | Generate, PDF | ZUGFeRD: `file` stashed, `filename` `invoice.pdf`, `contentType` `application/pdf`, `sizeBytes` 38217, `pdfKind` `hybrid`. Email by Zapier attached it and it arrived as `invoice.pdf`, 37.3 KB. The R97 samples show in the data picker (File, Filename `invoice.pdf`, Size 128000, PDF Kind `hybrid`); see §4 for how far they reach. |
| 5 | Validate | `valid` true, format `cii`, no errors, one info warning `BR-DE-TMP-32` (no delivery date or invoicing period). |
| 6 | Parse | Format `cii`; number `INV-2026-001`, issue date `2026-01-15`, currency `EUR`, total gross `1190`. |
| 7 | Convert | CII to UBL, profile EN 16931: `file` stashed, `filename` `invoice.ubl.xml`, `contentType` `application/xml`, `sizeBytes` 4302, `lostElementsCount` 0. Arrived as an email attachment, 4.2 KB. |
| 8 | Live Zap | The test Zap trimmed to two steps, "beliq 1.0.2 pass 2 check" (Schedule monthly on day 20 at 09:00, then Generate XML), was on from 01:09 to 01:37 CEST on 2026-10-01 and never ran. `zapier-platform validate`, logged in, then counted 8 publishing tasks instead of 11: S001 read "currently has 1" user with live Zaps, and S002, T001 and A001 cleared for `generate_invoice`. `zapier-platform versions` still showed 0 Zap users on `1.0.2` after 15 minutes of polling, so that column lags far longer than seconds; read S001 from `validate` instead. The Zap is off again and stays in the account as a draft. |
| 9 | Logs | `zapier-platform logs --type=http` lists a `GET /v1/me` per step test and none of the creates' SDK calls, as §0 says. |

Zapier-side facts found on the way, none of them a defect here:

- On the free plan a Zap with more than two steps needs a paid plan to turn on
  ("This Zap is using 1 Pro feature"). Testing each step in the editor still
  works. That matters for Pass 3's templates and its per-action live Zaps.
- Email by Zapier on the free plan sends test emails to the Zapier account's
  own address, whatever To says. A test that reported "Network Error" still
  sent its email.
- The Zapier account is the one the PolyDoc integration lives in: the only
  contact address the Publishing form offers is `backend+zapier@polydoc.tech`.

### Pass 3 - Zap templates + App Directory submission (operator)
- Author Zap templates in the developer dashboard (one per action angle), for
  example: Sheets row -> Generate Invoice -> email the PDF; new file -> Validate
  Invoice -> branch on `valid`; webhook -> Convert Invoice -> upload.
- `zapier-platform promote <version>` and submit for App Directory review.
- Adoption gates (all on the promoted version): 3 distinct users with a live
  Zap, at least 1 live Zap per action, a successful live run per action, a
  connected account, and M005 ("no users match domain": a user on the
  integration needs an email at the homepage's domain, `beliq.eu`; see
  https://docs.zapier.com/platform/publish/integration-checks-reference#M005).
  The only user today is `backend+zapier@polydoc.tech`, so M005 needs an
  `@beliq.eu` admin invited under Manage team first; the Publishing form's
  contact fields only offer team admins.
- The rest of the Publishing form (Integration readiness, Test account, Contact
  details, Compliance) is still empty; App details was saved on 2026-10-01.
- A live Zap per action (S002) on a free Zapier plan means two-step Zaps, one
  trigger and one beliq action each; the three-step template examples above
  need a paid plan to turn on.
  Reviewer rules to honor: 5.6 (connection label has no app
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
  D003 and D004, pass. Logged in, the gate therefore exits 1 until Pass 3's
  adoption gates are met: on 2026-09-30 it counted 40 checks passed and 11
  publishing tasks (T001 and S002 per action, A001, S001, M005). The anonymous
  run, which is what CI gets, passes. Run it with `HOME` pointed at an empty
  directory to reproduce CI locally.
- Tests are type-checked: `npm run typecheck` runs `tsc` over `src/` and `test/`
  with `tsconfig.test.json`, and CI runs it. `tsconfig.json` still excludes
  `test/`, because its `rootDir: src` shapes the `dist/` build.
- Generate has one operation `sample`, the XML shape. The keys only PDF output
  returns (`file`, `filename`, `sizeBytes`, `pdfKind`) carry their sample on
  their own output field, which Zapier merges into the operation sample.

## 4. Open questions / known unknowns

- Whether to add conditional field display for documentFile vs documentText, vs
  the current show-both + perform-side resolution. Current approach is robust.
- Which version Pass 3 promotes. `1.0.2` bundles `@beliq/sdk` 0.4.0; `main` locks 0.4.2 (#32,
  2026-09-28). Promoting `1.0.2` ships the older SDK, which works: 0.4.1 and 0.4.2 only add
  invoice fields, and the invoice JSON passes through. Pushing `1.0.3` first ships the current lock,
  but Pass 2's in-product check then has to run again on `1.0.3`.
- Whether the R97 output-field samples mislead. In the Zap editor's data picker they show even
  after a real test run: an XML-output Generate step offers File, Filename `invoice.pdf`, Size
  128000 and PDF Kind `hybrid`, which an XML run never returns, and a PDF run shows Size 128000
  (the sample) where the run returned 38217. At run time the real values flow, so the risk is a
  user mapping File from an XML-output step and getting an empty attachment. Samples live in
  `src/lib/samples.ts` (`generatePdfSample`) and are wired in `src/creates/generateInvoice.ts`.
  Not acted on: it is how Zapier merges field samples, and dropping them undoes R97.

## 5. Dependency state, measured 2026-09-21, re-read 2026-09-30

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

| Alert | Severity | Package | Advisory |
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

Alerts 32 and 33 closed with #18 on 2026-09-21. **Re-read 2026-09-30: three open, all development
scope, all reached through `zapier-platform-cli`:** alert 29 (`browserslist` 4.28.4, patched
4.28.7), alert 34 (`baseline-browser-mapping` 2.10.40, patched 2.11.0) and alert 36 (`ip-address`
10.4.0, `GHSA-2vr4-cq9g-pvrc`, patched 10.5.1, opened 2026-09-29). Each patched version sits inside
the range its consumer already allows, so a lockfile update fixes all three with no override
beyond one raised floor. The lock moved on 2026-09-30 to `browserslist` 4.29.3,
`baseline-browser-mapping` 2.11.26 and `ip-address` 10.7.2, and the `ip-address` override floor
went from `^10.3.1` (inside the vulnerable range) to `^10.5.1`. `npm ls --omit=dev` is unchanged,
so the pushed `1.0.2` bundle is unaffected. Alert URLs:
https://github.com/beliq-eu/zapier-beliq/security/dependabot/29,
https://github.com/beliq-eu/zapier-beliq/security/dependabot/34,
https://github.com/beliq-eu/zapier-beliq/security/dependabot/36.

Those three closed when [#34](https://github.com/beliq-eu/zapier-beliq/pull/34) merged (15:35 CEST).
The scan of that push opened four more, from advisories published 2026-09-29 against versions the
lock already held: alerts 45, 46 and 47 (`brace-expansion` 5.0.9, 2.1.4 and 1.1.18, patched 5.0.12,
2.1.7 and 1.1.21, under several `minimatch` majors) and alert 38 (`undici` 6.28.0 under `node-gyp`,
patched 6.28.1). All dev scope, all inside their consumers' ranges. The lock now holds
`brace-expansion` 5.0.12, 2.1.7 and 1.1.21 and `undici` 6.29.0, with the runtime tree unchanged.
The alerts appeared only on that push's scan, about 14 hours after the advisories were
published, so a re-read of open alerts can miss advisories that already apply.

**The `@sigstore/core` override is gone.** #4 (2026-08-08) added `"@sigstore/core": "^3.2.1"` to
clear alert 13 (`<= 3.2.0`). Its three consumers under `zapier-platform-cli` > `pacote` now declare
the floor themselves: `sigstore` 4.1.1 and `@sigstore/verify` 3.1.1 want `^3.2.1`, `@sigstore/sign`
`^3.2.0`, and npm keeps one copy that satisfies all three, so it still resolves to 3.2.1 and 3.2.0
cannot come back. [#33](https://github.com/beliq-eu/zapier-beliq/pull/33) wanted to raise that
override to `^4.0.0`, which would have forced a major none of the three supports; its `test` check
was green only because nothing runs that path. Keeping the override would have done the reverse
later: once `zapier-platform-cli` moves to a `sigstore` that needs core 4, it forces 3.x on it.

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

**Renovate updates this repo's lockfile, checked 2026-09-30.** On 2026-09-21 it could not: #17
arrived as a `package.json`-only change with `renovate/artifacts` failing, CI's `npm ci` refused the
manifest/lock mismatch, and the PR presented as a failing test run with nothing tested. It was fixed
by hand on #17's branch. The next two Renovate PRs both carried the lockfile:
[#32](https://github.com/beliq-eu/zapier-beliq/pull/32) (`@beliq/sdk` 0.4.2, lockfile only, merged by
`:automerge` 2026-09-28 06:51 CEST) and #33 (`package.json` plus `package-lock.json`, `test`
green). What changed on Renovate's side was not investigated. A relapse looks like #17: a
`package.json`-only diff and `npm ci` failing in `test`. [[bq-renovate-lockfile]] records the same
shape on the yarn siblings.

## 6. Parked / out of scope

- beliq-hq `CONNECTORS-ROADMAP.md`, "Sub-pass 8f", "Parked by 8f" owns two small zapier items: the
  `1.0.1` `source.zip` on Zapier carries a `.git` pointer file with a local absolute path, because
  the 8b script pushed from a worktree (`1.0.2` replaces it as the newest version); and
  `test/sample-invoice.test.ts` and `test/integration.test.ts` still use `any`. Tracked there, not
  copied here.
- The `sigstore` override (`"sigstore": "^4.1.1"`, `package.json`) has the latent shape the
  `@sigstore/core` one had (§5). It cannot go yet: `pacote` 21.5.1 declares `sigstore` `^4.0.0`,
  which still admits the versions alert 14 (`<= 4.1.0`) covers. Once a `pacote` inside
  `zapier-platform-cli` wants `sigstore` 5, the override forces 4.x on it and CI will not notice.
  Drop it then, or as soon as `pacote`'s own floor reaches 4.1.1. xs.
- The prefilled invoice (`src/creates/generateInvoice.ts`, the `INV-2026-001` default) validates
  with one info warning, `BR-DE-TMP-32`, because it carries neither a delivery date nor an
  invoicing period. Adding one gives a clean first Validate run. xs, but it is a code change, so it
  ships only with a `1.0.3` push, which reopens Pass 2 (§4). Batch it with whatever else `1.0.3`
  carries.
- beliq-hq `CONNECTORS-ROADMAP.md`'s Zapier status rows still name `1.0.1` as the pushed version
  (the "Zapier App Directory" row and the "Zapier | registered" row); it is `1.0.2`. beliq-hq's own
  fix, xs.
