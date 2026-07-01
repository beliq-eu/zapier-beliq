# Changelog

## 1.0.0

Initial release of the beliq integration.

- New action: Generate Invoice (generate_invoice). Build an EN 16931 e-invoice from structured JSON as XML or a hybrid PDF/A-3, with a saved PDF template and a verify option.
- New action: Validate Invoice (validate_invoice). Check a document against EN 16931 and national business rules.
- New action: Parse Invoice (parse_invoice). Extract structured fields from an invoice document.
- New action: Convert Invoice (convert_invoice). Convert between EN 16931 formats (CII, UBL, XRechnung, ZUGFeRD, Factur-X, Peppol BIS) and report which elements did not carry over.
- Powered by the official @beliq/sdk, so every action drives the same tested transport.
