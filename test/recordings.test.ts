import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { GenerateResult, ParseResult } from '@beliq/sdk';
import { generateXmlSample, parseRecorded, validateRecorded } from '../src/lib/samples';
import generatedPdf from '../src/lib/recorded/generate-facturx-pdf.json';
import generatedXml from '../src/lib/recorded/generate-xrechnung-xml.json';
import { VALIDATION_FIELDS, type Entry, type Field } from '../src/lib/validationFields';
import { VERDICT_OUTPUT_FIELDS, validateOutput } from '../src/lib/verdict';
import generatedNoVerify from './fixtures/generate-xrechnung-xml-noverify.json';
import validatedFrance from './fixtures/live-validate-france-previous.json';
import validatedNoBadge from './fixtures/live-validate-nobadge.json';
import parsedLeftOut from './fixtures/parse-fields-left-out.json';

// Each recording is cast to its SDK type where it is imported, because a JSON
// import carries no API types. These tests hold the casts: a key or a value
// shape that the output field map, or the SDK type, does not declare fails here.

const OUTPUT_MAP = new Map<string, Entry>([
  ...Object.entries(VALIDATION_FIELDS),
  ...VERDICT_OUTPUT_FIELDS.map(({ key, label }): [string, Entry] => [key, { label }]),
]);

function valueProblem(path: string, field: Field, value: unknown): string[] {
  if (field.list) {
    return Array.isArray(value) && value.every((v) => typeof v === 'string')
      ? []
      : [`${path} is not a list of strings`];
  }
  const want =
    field.type === 'boolean' ? 'boolean' : field.type === 'integer' || field.type === 'number' ? 'number' : 'string';
  return typeof value === want ? [] : [`${path} is a ${typeof value} where its field takes a ${want}`];
}

function objectProblems(path: string, map: Record<string, Field>, value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [`${path} is not an object`];
  return Object.entries(value).flatMap(([key, child]) => {
    const field = new Map(Object.entries(map)).get(key);
    return field ? valueProblem(`${path}.${key}`, field, child) : [`${path}.${key} has no output field`];
  });
}

/** What of a Validate Invoice output the output field map does not declare. */
function shapeProblems(output: object): string[] {
  return Object.entries(output).flatMap(([key, value]) => {
    const entry = OUTPUT_MAP.get(key);
    if (!entry) return [`${key} has no output field`];
    if ('items' in entry) {
      return Array.isArray(value)
        ? value.flatMap((item, i) => objectProblems(`${key}[${i}]`, entry.items, item))
        : [`${key} is not a list`];
    }
    if ('object' in entry) return objectProblems(key, entry.object, value);
    return valueProblem(key, entry, value);
  });
}

const PARSE_KEYS = {
  format: true,
  profileDetected: true,
  invoice: true,
  warnings: true,
  profileUrn: true,
  businessProcessId: true,
  franceCtcDetected: true,
} satisfies Record<keyof ParseResult, true>;

const INVOICE_KEYS = {
  lines: true,
  number: true,
  issueDate: true,
  currencyCode: true,
  documentType: true,
  typeCode: true,
  buyerReference: true,
  seller: true,
  buyer: true,
  delivery: true,
  totalNetAmount: true,
  totalTaxAmount: true,
  totalGrossAmount: true,
} satisfies Record<keyof ParseResult['invoice'], true>;

const GENERATE_META_KEYS = {
  schematronVersion: true,
  pdfKind: true,
  outputEnvelope: true,
  rulesetSha256: true,
  rulesetArtifacts: true,
  livemode: true,
} satisfies Record<keyof GenerateResult['meta'], true>;

const unknownKeys = (value: object, known: object): string[] =>
  Object.keys(value).filter((key) => !Object.hasOwn(known, key));

describe('recordings', () => {
  it('the walk names a key or a value shape the map does not declare', () => {
    // Proves the check can fail, so the clean results below mean something.
    expect(shapeProblems({ valid: 'yes', errors: [{ ruleId: 'R', extra: 1 }], gained: 1 })).toEqual([
      'valid is a string where its field takes a boolean',
      'errors[0].extra has no output field',
      'gained has no output field',
    ]);
  });

  it('every recorded verdict, run through Validate Invoice, fits the output field map', () => {
    const verdicts: [string, object][] = [
      ['validate', validateRecorded],
      ['validate, no badge', validatedNoBadge],
      ['validate, France block', validatedFrance],
      ['generate XML', generatedXml.validationResult],
      ['generate PDF', generatedPdf.validationResult],
      ['generate, Verify off', generatedNoVerify.validationResult],
    ];
    for (const [name, verdict] of verdicts) {
      expect(shapeProblems(validateOutput(verdict as typeof validateRecorded)), name).toEqual([]);
    }
  });

  it('the parse recordings hold only keys ParseResult types', () => {
    for (const answer of [parseRecorded, parsedLeftOut.data]) {
      expect(unknownKeys(answer, PARSE_KEYS)).toEqual([]);
      expect(unknownKeys(answer.invoice, INVOICE_KEYS)).toEqual([]);
    }
  });

  it('the generate recordings hold only the meta keys GenerateResult types', () => {
    for (const answer of [generatedXml, generatedPdf, generatedNoVerify]) {
      expect(unknownKeys(answer.meta, GENERATE_META_KEYS)).toEqual([]);
    }
  });

  it('the XML sample is the recorded document the validate and parse answers are about', () => {
    const sha256 = createHash('sha256').update(generateXmlSample.xml).digest('hex');
    expect(sha256).toBe(generatedXml.sha256);
    expect(sha256).toBe(validateRecorded.sha256);
    expect(generateXmlSample.xml).toContain(parseRecorded.invoice.number);
  });
});
