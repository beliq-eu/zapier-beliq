# zapier-beliq

Validate, generate, convert and parse EU e-invoices with the [beliq](https://beliq.eu) API from [Zapier](https://zapier.com). Every verdict carries the check depth the API states for it, or says that none was stated.

Four actions:

- **Generate Invoice** - build an e-invoice from EN 16931 invoice data in JSON, as XML or a hybrid PDF/A-3.
- **Validate Invoice** - check a document against the rule packs and schemas beliq lists for its format.
- **Parse Invoice** - extract structured fields from an invoice document.
- **Convert Invoice** - convert between EN 16931 formats (CII, UBL, XRechnung, ZUGFeRD, Factur-X, Peppol BIS).

Every action is powered by the official [`@beliq/sdk`](https://www.npmjs.com/package/@beliq/sdk), so it drives the same tested transport as the rest of the beliq connector family.

## Connect your account

Create a **beliq API key** at [dashboard.beliq.eu](https://dashboard.beliq.eu) (API Keys). Paste it into the **API Key** field when connecting. The connection test calls `GET /v1/me`, which returns your account context and consumes no quota.

## What you get back

- **Generate Invoice** returns the XML text (for XML output) or a Zapier **File** plus metadata (for PDF output), with the **Summary** and **Check Depth** of the document's verdict. With Verify off no ruleset runs, and Summary says `NOT VALIDATED`.
- **Validate Invoice** returns every field of the API's verdict as it came (`valid`, `format`, `verificationBadgeLabel`, the rule packs with their versions, `errors`, `warnings`, and the rest), plus two of its own. **Summary** gives the verdict with its check depth and its error and warning counts, after the lines of a France CTC block when the answer has `franceCtcBlockingRuleIds`. The API reports such a block apart from `valid`, so a filter on Valid alone does not catch it. **Check Depth** is `verificationBadgeLabel` as the API sent it, or `check depth not stated` when it sent none.
- **Parse Invoice** returns the structured invoice fields the parser read, and `warnings` naming what the document holds that the answer does not return. A field the parser read no value for is left out, not filled.
- **Convert Invoice** returns a Zapier **File** with the converted document, plus `lostElementsCount` and `lostElements` so you can see what did not carry over. For a Factur-X or ZUGFeRD target an XML source comes back as CII XML, and only a hybrid PDF source comes back as a PDF. A PDF answer carries a **PDF Note** that says what the PDF is ([the convert reference](https://docs.beliq.eu/api-reference/convert/#a-pdf-sent-for-a-zugferd-or-factur-x-target) has the detail).

A returned **File** is ready to attach or upload in a downstream Gmail, Drive, or Slack step.

## Document input

**Validate**, **Parse**, and **Convert** take a document either as pasted **Document Text** (the invoice XML) or as a **Document File** mapped from a previous step. beliq detects CII vs UBL from the content, or you can set the format explicitly.

## Public format coverage

The dropdowns carry every format the API accepts for each operation, which is
also every format [`GET /v1/rulesets`](https://docs.beliq.eu/api-reference/rulesets/)
publishes, with no API key, together with each format's rule pack, version and
badge. The badge says how deep the check of that format goes, and
[How verification works](https://docs.beliq.eu/compliance/how-verification-works/)
explains each depth. The Convert dropdowns are shorter than the Generate one
because the API's own convert enums are: no national format is a conversion
target.

## Development

```bash
npm install
npm run build        # tsc -> dist/
npm run typecheck    # type-check src/ and test/, emits nothing
npm run lint         # ESLint over src/, test/ and the root files
npm test             # unit tests (field-to-SDK mapping, no network)
npm run scrub:check  # fail if an em-dash slipped into a user-facing string
npm run validate     # schema + Zapier's integration checks, no login needed
```

`npm run validate` fails on a schema error, a failed integration check or a
publishing task. `zapier-platform validate` on its own exits non-zero only for
the schema error. General warnings, such as D003 and D004, pass.

Live smoke test against the real API. Use a sandbox key (`blq_test_...`), as CI
does: it draws on the sandbox allowance instead of the plan quota.

```bash
BELIQ_API_KEY=blq_test_xxx npm run test:integration
```

Push a private version to your Zapier editor:

```bash
npx zapier-platform login
npx zapier-platform register "beliq"   # first time only
npx zapier-platform push
```

## License

[MIT](./LICENSE)
