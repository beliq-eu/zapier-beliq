# Zap template drafts

Zap templates are built in Zapier's template creator
(https://zapier.com/webintent/create-template, listed afterwards at
https://developer.zapier.com/zap-templates), not committed as JSON. This file
holds the text to paste there. It is step D of Pass 3 in `../ROADMAP.md`.

Drafted 2026-10-01 against
https://docs.zapier.com/platform/publish/zap-templates. None of these exists on
Zapier yet.

## Rules that shaped the drafts

- **Templates need a public integration.** "Zap templates do not currently
  support private integrations", and a template cannot use a version that is not
  the promoted one. So no template can be created until `1.0.2` (or its
  successor) has passed App Directory review.
- **Banned steps:** Paths, Code, Webhooks, Looping and Formatter by Zapier. That
  rules out two of the three angles this file used to list: "webhook to Convert
  Invoice" and "branch on `valid`" as a Path. Filter by Zapier is allowed, so
  the `valid` angle survives as a filter.
- **Only fixed fields can be mapped.** Fields a user adds in the other app
  (Google Sheets columns, Airtable fields) are not available in a template.
- **Title:** starts with a verb, sentence case, present tense, says "new" or
  "updated" for the trigger item, plural items, no "sync", no "automatic", no
  pronouns.
- **Description:** one paragraph of 2 to 4 sentences, the problem first, no
  links, none of Zapier's own terms ("Zap", "trigger"), unique per template. A
  setup tip goes last as an italic `*Note:*`.
- **Count:** Zapier suggests 5 to 10 to start and also rejects "disproportionate
  submissions relative to app user count". With three users, submit the first
  four (one per action) and hold the fifth.
- Review takes up to 2 weeks. A published template cannot be edited by its
  author afterwards, only through Zapier support.

The step names of the other apps below are written from memory of Zapier's app
pages. Confirm each one in the editor before submitting.

## 1. Parse (two steps plus the row)

- **Title:** Add Google Sheets rows for new Google Drive e-invoices parsed with beliq
- **Steps:** Google Drive, New File in Folder. beliq, Parse Invoice. Google
  Sheets, Create Spreadsheet Row.
- **Mapping:** Document File = the Drive step's File. Format stays Auto-detect.
  The sheet's columns belong to the user, so the row is left for them to map
  from Invoice Number, Issue Date, Currency and Total Gross Amount.
- **Description:** Typing invoice numbers, dates and totals from XML e-invoices
  into a spreadsheet is slow and easy to get wrong. This workflow reads every
  XRechnung, ZUGFeRD, Factur-X or Peppol BIS invoice saved to a Google Drive
  folder with beliq and adds its key figures as a new row in Google Sheets.
  *Note:* the folder must hold the invoice XML, not a scanned PDF.

## 2. Validate (filter, then notify)

- **Title:** Send Slack messages for new Google Drive e-invoices that fail beliq validation
- **Steps:** Google Drive, New File in Folder. beliq, Validate Invoice. Filter
  by Zapier, continue only if Valid is false. Slack, Send Channel Message.
- **Mapping:** Document File = File. Message text = the Drive file's name, plus
  Format and Schematron Version from the beliq step.
- **Description:** An e-invoice that breaks EN 16931 or a national rule is
  rejected by the recipient's system, often days after it was sent. This
  workflow checks every invoice saved to a Google Drive folder with beliq and
  posts to a Slack channel when one fails, so it is fixed before it goes out.

## 3. Convert (file in, file out)

- **Title:** Convert new Google Drive e-invoices with beliq and upload the results to Google Drive
- **Steps:** Google Drive, New File in Folder. beliq, Convert Invoice. Google
  Drive, Upload File.
- **Mapping:** Document File = File. Target Format stays at its default (UBL).
  Upload File's File = the beliq step's File, File Name = Filename.
- **Description:** Some recipients take only UBL and others only CII, so one
  invoice often has to exist in both. This workflow converts every e-invoice
  saved to a Google Drive folder into the other format with beliq and uploads
  the result. *Note:* upload to a different folder than the one being watched,
  or the converted file starts the workflow again.

## 4. Generate (the weak one, see below)

- **Title:** Generate beliq e-invoices for new QuickBooks Online invoices
- **Steps:** QuickBooks Online, New Invoice. beliq, Generate Invoice.
- **Mapping:** Standard and Output stay at their defaults. Invoice Data (JSON)
  holds the prefilled invoice with the QuickBooks fields mapped into it: number,
  dates, customer name and address, totals.
- **Description:** German and French business customers increasingly need a
  structured e-invoice and not only a PDF. This workflow turns every new
  QuickBooks Online invoice into an EN 16931 e-invoice with beliq, as XRechnung,
  ZUGFeRD, Factur-X or Peppol BIS. *Note:* the seller's VAT ID and address are
  entered once in the invoice data.

## 5. Generate PDF and email it (hold for a second round)

- **Title:** Send Gmail emails with beliq e-invoices for new QuickBooks Online invoices
- **Steps:** QuickBooks Online, New Invoice. beliq, Generate Invoice with Output
  PDF and Standard ZUGFeRD. Gmail, Send Email.
- **Mapping:** as draft 4, plus Gmail's To = the customer's email, Attachments =
  the beliq step's File.
- **Description:** Sending a compliant e-invoice usually means exporting,
  converting and attaching it by hand. This workflow builds a ZUGFeRD PDF with
  the invoice data embedded for every new QuickBooks Online invoice with beliq
  and emails it to the customer from Gmail.

## Why Generate is the weak one

Generate Invoice takes the whole invoice as one JSON text field, so a template
has to map the other app's fields inside JSON text, and line items do not map
that way at all. Zapier rejects templates with hardcoded values or unmapped
required fields. Google Sheets, the angle this file used to list, is worse:
its columns are user-added and cannot be mapped in a template. Whether drafts 4
and 5 pass review is not known. If they do not, Generate needs separate input
fields for the common invoice parts, which is a code change and a new version.
`../ROADMAP.md` §4 carries this.
