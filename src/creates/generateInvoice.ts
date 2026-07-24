import type { Bundle, PlainInputField, ZObject } from 'zapier-platform-core';
import type { GenerateInput, Invoice, GenerateProfile } from '@beliq/sdk';
import { asJsonObject, createClient, mapError, type BeliqAuthData } from '../lib/client';
import { stashDocument } from '../lib/io';
import {
  GENERATE_STANDARD_CHOICES,
  OUTPUT_CHOICES,
  PROFILE_CHOICES,
  resolveGenerateTarget,
} from '../lib/options';
import { generateXmlSample } from '../lib/samples';

// EN 16931-valid default: dueDate (rule BR-CO-25), seller taxId for VAT category
// S, a taxSummary, and consistent totals (net + tax = gross). Generates as-is so
// a user gets a 200 on the first run instead of a 422.
const defaultInvoice = JSON.stringify(
  {
    number: 'INV-001',
    issueDate: '2026-01-31',
    dueDate: '2026-03-02',
    currencyCode: 'EUR',
    seller: {
      name: 'Your Company GmbH',
      address: { line1: 'Main St 1', city: 'Berlin', postalCode: '10115', countryCode: 'DE' },
      taxId: 'DE123456789',
    },
    buyer: {
      name: 'Customer SARL',
      address: { line1: 'Rue 2', city: 'Paris', postalCode: '75001', countryCode: 'FR' },
    },
    lines: [
      { description: 'Widget', quantity: 2, unitPrice: 10, lineTotal: 20, vatRate: 19, vatCategoryCode: 'S' },
    ],
    taxSummary: [{ categoryCode: 'S', rate: 19, taxableAmount: 20, taxAmount: 3.8 }],
    paymentTerms: 'Net 30 days',
    totalNetAmount: 20,
    totalTaxAmount: 3.8,
    totalGrossAmount: 23.8,
  },
  null,
  2,
);

const inputFields: PlainInputField[] = [
  {
    key: 'standard',
    label: 'Standard',
    type: 'string',
    required: true,
    default: 'xrechnung',
    choices: GENERATE_STANDARD_CHOICES,
    helpText: 'The e-invoice standard to produce.',
  },
  {
    key: 'profile',
    label: 'Profile',
    type: 'string',
    default: 'en16931',
    choices: PROFILE_CHOICES,
    helpText: 'The data granularity profile to build against.',
  },
  {
    key: 'output',
    label: 'Output',
    type: 'string',
    default: 'xml',
    choices: OUTPUT_CHOICES,
    helpText: 'XML returns the invoice as text. PDF returns a hybrid PDF/A-3 with the XML embedded.',
  },
  {
    key: 'invoice',
    label: 'Invoice Data (JSON)',
    type: 'text',
    required: true,
    default: defaultInvoice,
    helpText:
      'Structured EN 16931 invoice data: seller, buyer, lines, totals. See the [full schema](https://docs.beliq.eu).',
  },
  {
    key: 'pdfTemplateId',
    label: 'PDF Template ID',
    type: 'string',
    helpText:
      'ID of a saved beliq PDF template (from the dashboard). Used only when Output is PDF; leave blank for the default layout.',
  },
  {
    key: 'verify',
    label: 'Verify',
    type: 'boolean',
    default: 'false',
    helpText: 'Validate the generated document before returning (returns an error if it fails).',
  },
];

function bool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

const perform = async (z: ZObject, bundle: Bundle) => {
  const input = bundle.inputData ?? {};
  const invoice = asJsonObject(input.invoice);
  if (!invoice) {
    throw new z.errors.Error(
      'Invoice Data must be a JSON object with invoice fields.',
      'InvalidInput',
      400,
    );
  }

  const target = resolveGenerateTarget(typeof input.standard === 'string' ? input.standard : 'xrechnung');
  const output = (target.output ??
    (typeof input.output === 'string' ? input.output : 'xml')) as 'xml' | 'pdf';
  const generateInput: GenerateInput = {
    standard: target.standard,
    invoice: invoice as Invoice,
    output,
  };
  if (target.profile) {
    generateInput.profile = target.profile as GenerateProfile;
  } else if (typeof input.profile === 'string' && input.profile !== '') {
    generateInput.profile = input.profile as GenerateProfile;
  }
  if (typeof input.pdfTemplateId === 'string' && input.pdfTemplateId !== '') {
    generateInput.pdfTemplateId = input.pdfTemplateId;
  }
  const verify = bool(input.verify);
  if (verify !== undefined) generateInput.verify = verify;

  const client = createClient(bundle.authData as BeliqAuthData);
  let result;
  try {
    result = await client.generate(generateInput);
  } catch (error) {
    throw mapError(error);
  }

  if (output === 'pdf') {
    const filename = 'invoice.pdf';
    const contentType = result.contentType.split(';')[0].trim() || 'application/pdf';
    const file = await stashDocument(z, result.bytes, filename, contentType);
    return {
      file,
      filename,
      contentType,
      sizeBytes: result.bytes.length,
      pdfKind: result.meta.pdfKind ?? null,
    };
  }

  return {
    xml: result.xml,
    contentType: result.contentType.split(';')[0].trim() || 'application/xml',
    schematronVersion: result.meta.schematronVersion ?? null,
    outputEnvelope: result.meta.outputEnvelope ?? null,
  };
};

export default {
  key: 'generate_invoice',
  noun: 'Invoice',
  display: {
    label: 'Generate Invoice',
    description: 'Generates an EN 16931 e-invoice as XML or a hybrid PDF/A-3.',
  },
  operation: {
    inputFields,
    perform,
    sample: generateXmlSample,
    outputFields: [
      { key: 'xml', label: 'XML' },
      { key: 'file', label: 'File', type: 'file' },
      { key: 'filename', label: 'Filename' },
      { key: 'contentType', label: 'Content Type' },
      { key: 'sizeBytes', label: 'Size (bytes)', type: 'integer' },
      { key: 'schematronVersion', label: 'Schematron Version' },
      { key: 'outputEnvelope', label: 'Output Envelope' },
      { key: 'pdfKind', label: 'PDF Kind' },
    ],
  },
};
