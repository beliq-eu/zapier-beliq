import type { Bundle, PlainInputField, ZObject } from 'zapier-platform-core';
import type { ConvertOptions, ConvertTargetFormat, FacturxProfile } from '@beliq/sdk';
import { createClient, mapError, type BeliqAuthData } from '../lib/client';
import { resolveDocument, stashDocument } from '../lib/io';
import { CONVERT_TARGET_CHOICES, PROFILE_CHOICES } from '../lib/options';
import { convertSample } from '../lib/samples';

const inputFields: PlainInputField[] = [
  {
    key: 'documentFile',
    label: 'Document File',
    type: 'file',
    helpText: 'A file from a previous step (the source invoice). Use this or Document Text.',
  },
  {
    key: 'documentText',
    label: 'Document Text',
    type: 'text',
    helpText: 'Paste the source invoice XML directly. Used when Document File is empty.',
  },
  {
    key: 'targetFormat',
    label: 'Target Format',
    type: 'string',
    required: true,
    default: 'ubl',
    choices: CONVERT_TARGET_CHOICES,
    helpText: 'The format to convert the document into.',
  },
  {
    key: 'profile',
    label: 'Profile',
    type: 'string',
    default: 'en16931',
    choices: PROFILE_CHOICES,
    helpText: 'The target profile. Applies only when Target Format is Factur-X or ZUGFeRD.',
  },
];

// The hybrid-PDF targets return a PDF; the pure-XML targets return XML.
const PDF_TARGETS: ReadonlySet<string> = new Set(['facturx', 'zugferd']);

function outputFilename(targetFormat: string): string {
  return PDF_TARGETS.has(targetFormat) ? 'invoice.pdf' : `invoice.${targetFormat}.xml`;
}

const perform = async (z: ZObject, bundle: Bundle) => {
  const input = bundle.inputData ?? {};
  const document = await resolveDocument(z, bundle);
  const targetFormat = (typeof input.targetFormat === 'string' ? input.targetFormat : 'ubl') as ConvertTargetFormat;

  const options: ConvertOptions = { targetFormat };
  if (typeof input.profile === 'string' && input.profile !== '') {
    options.targetProfile = input.profile as FacturxProfile;
  }

  const client = createClient(bundle.authData as BeliqAuthData);
  let result;
  try {
    result = await client.convert(document, options);
  } catch (error) {
    throw mapError(error);
  }

  const filename = outputFilename(targetFormat);
  const contentType = result.contentType.split(';')[0].trim() || 'application/octet-stream';
  const file = await stashDocument(z, result.bytes, filename, contentType);

  return {
    file,
    filename,
    contentType,
    sizeBytes: result.bytes.length,
    lostElementsCount: result.meta.lostElementsCount ?? 0,
    lostElements: result.meta.lostElements ?? [],
  };
};

export default {
  key: 'convert_invoice',
  noun: 'Converted Invoice',
  display: {
    label: 'Convert Invoice',
    description: 'Converts an e-invoice between EN 16931 formats.',
  },
  operation: {
    inputFields,
    perform,
    sample: convertSample,
    outputFields: [
      { key: 'file', label: 'File', type: 'file' },
      { key: 'filename', label: 'Filename' },
      { key: 'contentType', label: 'Content Type' },
      { key: 'sizeBytes', label: 'Size (bytes)', type: 'integer' },
      { key: 'lostElementsCount', label: 'Lost Elements Count', type: 'integer' },
      // lostElements is a string array; Zapier infers it from the sample. A
      // scalar-typed output field here would report a D024 type mismatch.
    ],
  },
};
