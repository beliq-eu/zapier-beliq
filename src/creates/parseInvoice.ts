import type { Bundle, PlainInputField, ZObject } from 'zapier-platform-core';
import type { ParseFormat } from '@beliq/sdk';
import { createClient, mapError, type BeliqAuthData } from '../lib/client';
import { resolveDocument } from '../lib/io';
import { PARSE_FORMAT_CHOICES } from '../lib/options';
import { parseSample } from '../lib/samples';

const inputFields: PlainInputField[] = [
  {
    key: 'documentFile',
    label: 'Document File',
    type: 'file',
    helpText: 'A file from a previous step (the invoice XML). Use this or Document Text.',
  },
  {
    key: 'documentText',
    label: 'Document Text',
    type: 'text',
    helpText: 'Paste the invoice XML directly. Used when Document File is empty.',
  },
  {
    key: 'format',
    label: 'Format',
    type: 'string',
    default: 'auto',
    choices: PARSE_FORMAT_CHOICES,
    helpText: 'The syntax to read the document as. Auto-detect picks CII or UBL from the content.',
  },
];

const perform = async (z: ZObject, bundle: Bundle) => {
  const input = bundle.inputData ?? {};
  const document = await resolveDocument(z, bundle);
  const format = (typeof input.format === 'string' ? input.format : 'auto') as ParseFormat;

  const client = createClient(bundle.authData as BeliqAuthData);
  try {
    return await client.parse(document, { format });
  } catch (error) {
    throw mapError(error);
  }
};

export default {
  key: 'parse_invoice',
  noun: 'Invoice Data',
  display: {
    label: 'Parse Invoice',
    description:
      'Parses an e-invoice document into structured fields. Its warnings name what the document holds that the answer does not return.',
  },
  operation: {
    inputFields,
    perform,
    sample: parseSample,
    // The API returns an invoice field only when the parser read a value for
    // it, and puts nothing in the place of one it did not, so each label says so.
    outputFields: [
      { key: 'format', label: 'Format' },
      { key: 'invoice__number', label: 'Invoice Number (absent if not read)' },
      { key: 'invoice__issueDate', label: 'Issue Date (absent if not read)' },
      { key: 'invoice__currencyCode', label: 'Currency (absent if not read)' },
      {
        key: 'invoice__totalGrossAmount',
        label: 'Total Gross Amount (absent if not read)',
        type: 'number',
      },
    ],
  },
};
