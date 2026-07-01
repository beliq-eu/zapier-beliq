# zapier-beliq

A [Zapier](https://zapier.com) integration for [beliq](https://beliq.eu). beliq is a REST API that generates, validates, parses, and converts EU-compliant e-invoices (XRechnung, ZUGFeRD, Factur-X, Peppol BIS) against authority-pinned, drift-checked rules.

Four actions:

- **Generate Invoice** - build an EN 16931 e-invoice from structured JSON, as XML or a hybrid PDF/A-3.
- **Validate Invoice** - check a document against EN 16931 and national business rules.
- **Parse Invoice** - extract structured fields from an invoice document.
- **Convert Invoice** - convert between EN 16931 formats (CII, UBL, XRechnung, ZUGFeRD, Factur-X, Peppol BIS).

Every action is powered by the official [`@beliq/sdk`](https://www.npmjs.com/package/@beliq/sdk), so it drives the same tested transport as the rest of the beliq connector family.

## Connect your account

Create a **beliq API key** at [dashboard.beliq.eu](https://dashboard.beliq.eu) (API Keys). Paste it into the **API Key** field when connecting. The connection test calls `GET /v1/me`, which returns your account context and consumes no quota.

## What you get back

- **Generate Invoice** returns the XML text (for XML output) or a Zapier **File** plus metadata (for PDF output).
- **Validate Invoice** returns the validation verdict: `valid`, `format`, and the rule versions it was checked against.
- **Parse Invoice** returns the structured invoice fields.
- **Convert Invoice** returns a Zapier **File** with the converted document, plus `lostElementsCount` and `lostElements` so you can see what did not carry over.

A returned **File** is ready to attach or upload in a downstream Gmail, Drive, or Slack step.

## Document input

**Validate**, **Parse**, and **Convert** take a document either as pasted **Document Text** (the invoice XML) or as a **Document File** mapped from a previous step. beliq detects CII vs UBL from the content, or you can set the format explicitly.

## Public format coverage

The dropdowns list the formats beliq offers publicly today. The API can accept additional provisional formats; those are reachable through the underlying API but are intentionally kept out of the UI.

## Development

```bash
npm install
npm run build        # tsc -> dist/
npm test             # unit tests (field-to-SDK mapping, no network)
npm run scrub:check  # fail if an em-dash slipped into a user-facing string
npx zapier-platform validate   # structural + conformance checks (needs Zapier login)
```

Live smoke test against the real API:

```bash
BELIQ_API_KEY=api_xxx npm run test:integration
```

Push a private version to your Zapier editor:

```bash
npx zapier-platform login
npx zapier-platform register "beliq"   # first time only
npx zapier-platform push
```

## License

[MIT](./LICENSE)
