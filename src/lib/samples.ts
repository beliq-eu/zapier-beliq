// Static sample outputs Zapier shows while a user maps fields, before any live
// run. For a stashed document the `file` field is a Zapier-hosted URL (the shape
// z.stashFile returns).
//
// The files under `recorded/` are answers of the live API, recorded on
// 2026-10-25 for the prefilled Invoice Data of Generate Invoice and stored as
// the SDK returned them, with a generated document's bytes left out and their
// length kept. A sandbox key recorded them: it marks the document it returns,
// and its verdicts are the ones a live key gets. Each sample below is what a run
// returns for that answer.
import type { ParseResult, ValidationResult } from '@beliq/sdk';
import { verdictOutput } from './verdict';
import generatedPdf from './recorded/generate-facturx-pdf.json';
import generatedXml from './recorded/generate-xrechnung-xml.json';
import parsed from './recorded/parse-xrechnung.json';
import validated from './recorded/validate-xrechnung.json';

export const validateRecorded = validated as ValidationResult;
export const parseRecorded = parsed as ParseResult;

export const generateXmlSample = {
  // The document itself, cut short here.
  xml: '<?xml version="1.0" encoding="UTF-8"?>\n<rsm:CrossIndustryInvoice>...</rsm:CrossIndustryInvoice>',
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

export const validateSample = { ...verdictOutput(validateRecorded), ...validateRecorded };

export const parseSample = parseRecorded;

export const convertSample = {
  file: 'https://zapier-dev-files.s3.amazonaws.com/cli-platform/invoice.ubl.xml',
  filename: 'invoice.ubl.xml',
  contentType: 'application/xml',
  sizeBytes: 4096,
  lostElementsCount: 0,
  lostElements: [],
};
