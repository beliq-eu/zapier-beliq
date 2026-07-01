// Static sample outputs Zapier shows while a user maps fields, before any live
// run. For a stashed document the `file` field is a Zapier-hosted URL (the shape
// z.stashFile returns).

export const generateXmlSample = {
  xml: '<?xml version="1.0" encoding="UTF-8"?>\n<Invoice>...</Invoice>',
  contentType: 'application/xml',
  schematronVersion: 'xrechnung-3.0.2',
  outputEnvelope: 'ubl',
};

export const generatePdfSample = {
  file: 'https://zapier-dev-files.s3.amazonaws.com/cli-platform/invoice.pdf',
  filename: 'invoice.pdf',
  contentType: 'application/pdf',
  sizeBytes: 128000,
  pdfKind: 'facturx',
};

export const validateSample = {
  valid: true,
  format: 'ubl',
  errors: [],
  warnings: [],
  schematronVersion: 'en16931-1.3.13',
};

export const parseSample = {
  invoice: {
    number: 'INV-001',
    issueDate: '2026-01-31',
    currencyCode: 'EUR',
    totalGrossAmount: 23.8,
  },
  format: 'ubl',
};

export const convertSample = {
  file: 'https://zapier-dev-files.s3.amazonaws.com/cli-platform/invoice.ubl.xml',
  filename: 'invoice.ubl.xml',
  contentType: 'application/xml',
  sizeBytes: 4096,
  lostElementsCount: 0,
  lostElements: [],
};
