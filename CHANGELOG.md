# Changelog

Version numbers follow the Zapier integration's own chain, which Zapier requires
to be contiguous: a push of `X.Y.Z` is rejected unless its immediate predecessor
already exists on the platform. `1.0.0` is therefore the first number this
integration can carry, and it contains everything built before registration.

## 1.0.3 - unreleased

- Validate Invoice returns every field of the API's verdict as it came, each
  declared as an output field, plus **Summary** and **Check Depth**. Check Depth
  is the badge label the API sent (`verificationBadgeLabel`), or
  `check depth not stated` when it sent none. Summary gives the verdict with that
  depth and its counts, after the lines of a France CTC block, which the API
  reports apart from `valid`. It had returned the answer with three declared
  fields and a description that named national business rules for every
  format.
- Generate Invoice asks for the API's JSON envelope, the only answer that
  carries the verdict's check depth, and returns the same Summary and Check
  Depth. With Verify off no ruleset runs, Summary says `NOT VALIDATED` and no
  depth is named. The Output Envelope field is gone: generate never sends it,
  so it was always empty.
- Convert Invoice names the file after the answer's content type. A Factur-X or
  ZUGFeRD target returns CII XML for an XML source, which had been named
  `invoice.pdf`. A PDF answer carries a **PDF Note** that says what the PDF is.
- Parse Invoice's four mapped invoice fields say in their labels that the API
  leaves a field out when the parser read no value for it.
- The samples Zapier shows before a test run are answers of the live API,
  recorded on 2026-10-25.
- `@beliq/sdk` 0.5.2, up from 0.4.5, for the verdict and convert wording in
  `@beliq/sdk/helpers`. The build resolves modules as Node 16 does, which reads
  that subpath; the compiled output is otherwise unchanged.
- The README and package description no longer call the documents compliant or
  the rules authority-pinned and drift-checked, and no longer list a badge per
  format: `GET /v1/rulesets` publishes each format's badge.

## 1.0.2 - 2026-09-26

- Generate Invoice's PDF-only output fields (File, Filename, Size (bytes), PDF
  Kind) carry sample values, so the Zap editor shows them before a test run.

## 1.0.1 - 2026-09-24

- The Output field's help text says NLCIUS always returns XML. Choosing NLCIUS
  sends Peppol BIS with the `netherlands-nlcius` profile as XML, so an Output of
  PDF was dropped without a word; it still is, but the form now says so.
- `@beliq/sdk` 0.4.0, up from 0.3.1.
- `zapier-platform-core` 19.1.0, up from 19.0.0, which clears Zapier's D027
  upgrade warning.

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
