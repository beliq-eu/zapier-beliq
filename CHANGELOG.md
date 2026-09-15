# Changelog

Version numbers follow the Zapier integration's own chain, which Zapier requires
to be contiguous: a push of `X.Y.Z` is rejected unless its immediate predecessor
already exists on the platform. `1.0.0` is therefore the first number this
integration can carry, and it contains everything built before registration.

## 1.0.0 - 2026-09-15

First version pushed to Zapier (integration `App246379`, private).

- Generate Invoice (generate_invoice). Build an EN 16931 e-invoice from
  structured JSON as XML or a hybrid PDF/A-3, with a saved PDF template and a
  verify option.
- Validate Invoice (validate_invoice). Check a document against EN 16931 and
  national business rules.
- Parse Invoice (parse_invoice). Extract structured fields from an invoice
  document.
- Convert Invoice (convert_invoice). Convert between EN 16931 formats (CII, UBL,
  XRechnung, ZUGFeRD, Factur-X, Peppol BIS) and report which elements did not
  carry over.
- Powered by the official `@beliq/sdk`, so every action drives the same tested
  transport.
- NLCIUS generate target (Peppol BIS with the `netherlands-nlcius` profile).
- Profile is gated per standard. XRechnung and Peppol BIS pin their own, so a
  Profile chosen for them is dropped rather than sent as a 422; ZUGFeRD does not
  accept the France CTC overlay profile.
- Verify defaults on, so an invalid document fails instead of being returned.
- Output=PDF works on XRechnung and Peppol BIS. Those two have no hybrid PDF and
  the API refuses PDF output for them unless the request asks for a visual to
  render, so the choice used to be a 400 nothing the user could type avoided.
  The returned PDF is a visualization with no XML inside it; for those two
  standards the legal document is still the XML.
- The prefilled invoice's Peppol ids are valid GLNs. Both carried a wrong GS1
  check digit, so a first run on Peppol BIS was four fatal
  `PEPPOL-COMMON-R040`s. XRechnung never showed it: its builder addresses the
  party by email and ignores the Peppol id entirely.
- `@beliq/sdk` 0.3.x, which adds a per-attempt deadline and retries transient
  failures.
