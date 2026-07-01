import type { Bundle, PlainInputField, ZObject } from 'zapier-platform-core';
import type { ValidateFormat } from '@beliq/sdk';
import { createClient, mapError, type BeliqAuthData } from '../lib/client';
import { resolveDocument } from '../lib/io';
import { VALIDATE_FORMAT_CHOICES } from '../lib/options';
import { validateSample } from '../lib/samples';

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
    choices: VALIDATE_FORMAT_CHOICES,
    helpText: 'The syntax to read the document as. Auto-detect picks CII or UBL from the content.',
  },
];

const perform = async (z: ZObject, bundle: Bundle) => {
  const input = bundle.inputData ?? {};
  const document = await resolveDocument(z, bundle);
  const format = (typeof input.format === 'string' ? input.format : 'auto') as ValidateFormat;

  const client = createClient(bundle.authData as BeliqAuthData);
  try {
    return await client.validate(document, { format });
  } catch (error) {
    throw mapError(error);
  }
};

export default {
  key: 'validate_invoice',
  noun: 'Validation',
  display: {
    label: 'Validate Invoice',
    description: 'Validates an e-invoice document against EN 16931 and national business rules.',
  },
  operation: {
    inputFields,
    perform,
    sample: validateSample,
    outputFields: [
      { key: 'valid', label: 'Valid', type: 'boolean' },
      { key: 'format', label: 'Format' },
      { key: 'schematronVersion', label: 'Schematron Version' },
    ],
  },
};
