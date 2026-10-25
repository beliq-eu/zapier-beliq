// Static sample outputs Zapier shows while a user maps fields, before any live
// run. For a stashed document the `file` field is a Zapier-hosted URL (the shape
// z.stashFile returns).
//
// The files under `recorded/` are answers of the live API, recorded on
// 2026-10-25 for the prefilled Invoice Data of Generate Invoice and stored as
// the SDK returned them. The XML document is kept whole, and it is the one the
// validate and parse answers are about; of the PDF only its length is kept. A
// sandbox key recorded them: it marks the document it returns, and its verdicts
// are the ones a live key gets. Each sample below is what a run returns for
// that answer. The JSON imports carry no API types, so the casts here are held
// by the test that walks each recording through the output field map
// (test/mapping.test.ts, "recordings").
import type { ParseResult, ValidationResult } from '@beliq/sdk';
import { validateOutput, verdictOutput } from './verdict';
import generatedPdf from './recorded/generate-facturx-pdf.json';
import generatedXml from './recorded/generate-xrechnung-xml.json';
import parsed from './recorded/parse-xrechnung.json';
import validated from './recorded/validate-xrechnung.json';

export const validateRecorded = validated as ValidationResult;
export const parseRecorded = parsed as ParseResult;

export const generateXmlSample = {
  xml: generatedXml.xml,
  contentType: generatedXml.contentType,
  schematronVersion: generatedXml.meta.schematronVersion,
  ...verdictOutput(generatedXml.validationResult as ValidationResult),
};

// An operation carries a single `sample`, so Generate's is the XML shape above.
// These are the keys only PDF output returns. generateInvoice sets each one as
// its output field's own `sample`, which Zapier merges into the operation sample.
export const generatePdfSample = {
  file: 'https://zapier-dev-files.s3.amazonaws.com/cli-platform/invoice.pdf',
  filename: 'invoice.pdf',
  sizeBytes: generatedPdf.byteLength,
  pdfKind: generatedPdf.meta.pdfKind,
};

export const validateSample = validateOutput(validateRecorded);

export const parseSample = parseRecorded;

export const convertSample = {
  file: 'https://zapier-dev-files.s3.amazonaws.com/cli-platform/invoice.ubl.xml',
  filename: 'invoice.ubl.xml',
  contentType: 'application/xml',
  sizeBytes: 4096,
  lostElementsCount: 0,
  lostElements: [],
};
