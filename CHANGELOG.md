# Changelog

## 1.2.0

- Profile is gated per standard. XRechnung and Peppol BIS pin their own, so a
  Profile chosen for them is dropped rather than sent as a 422; ZUGFeRD no
  longer accepts the France CTC overlay profile.
- Verify defaults on, so an invalid document fails instead of being returned.
- `@beliq/sdk` 0.3.0, which adds a per-attempt deadline and retries transient
  failures.

## 1.1.0

- NLCIUS generate target (Peppol BIS with the `netherlands-nlcius` profile).
- `@beliq/sdk` 0.2.0.

## 1.0.0

Initial release of the beliq integration.

- New action: Generate Invoice (generate_invoice). Build an EN 16931 e-invoice from structured JSON as XML or a hybrid PDF/A-3, with a saved PDF template and a verify option.
- New action: Validate Invoice (validate_invoice). Check a document against EN 16931 and national business rules.
- New action: Parse Invoice (parse_invoice). Extract structured fields from an invoice document.
- New action: Convert Invoice (convert_invoice). Convert between EN 16931 formats (CII, UBL, XRechnung, ZUGFeRD, Factur-X, Peppol BIS) and report which elements did not carry over.
- Powered by the official @beliq/sdk, so every action drives the same tested transport.
