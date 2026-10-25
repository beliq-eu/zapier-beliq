import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Bundle, ZObject } from 'zapier-platform-core';

// Unit tests for the field-to-SDK mapping in each create. No network: the SDK
// accepts an injected `fetch`, so we record the outgoing request the create
// drives and assert the URL, method, headers, and body the SDK actually sends,
// plus the shape the create returns (including the stash for binary outputs).
//
// The creates call the SDK through `bundle.authData` and `bundle.inputData`, so
// each test drives the create's perform with a stub `z` and a bundle. The
// perform functions live on the default-exported create objects.

interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  rawBody?: Uint8Array;
}

interface FetchResponse {
  status?: number;
  headers?: Record<string, string>;
  body: string | Uint8Array;
}

/**
 * A recording fetch that captures the outgoing request and returns a canned
 * response. Mirrors the subset of the Fetch API the SDK transport uses
 * (`ok`, `status`, `headers.get`, `arrayBuffer`).
 */
function recordingFetch(response: FetchResponse, recorder: RecordedRequest[]): typeof fetch {
  return (async (url: string | URL, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const rawInit = init?.body;
    const record: RecordedRequest = { url: String(url), method, headers };
    if (typeof rawInit === 'string') record.body = rawInit;
    else if (rawInit instanceof Uint8Array) record.rawBody = rawInit;
    recorder.push(record);

    const status = response.status ?? 200;
    const bytes =
      typeof response.body === 'string' ? new TextEncoder().encode(response.body) : response.body;
    const headerMap = new Headers(response.headers ?? {});
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: headerMap,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    };
  }) as unknown as typeof fetch;
}

interface StashCall {
  buffer: Buffer;
  length: number;
  filename: string;
  contentType: string;
}

/** Stub `z` that records `stashFile` calls and returns a fake File URL. */
function makeZ(stashes: StashCall[]) {
  return {
    stashFile: async (buffer: Buffer, length: number, filename: string, contentType: string) => {
      stashes.push({ buffer, length, filename, contentType });
      return `https://files.zapier.test/${filename}`;
    },
    request: async () => {
      throw new Error('z.request should not be called in these mapping tests');
    },
    errors: {
      Error: class extends Error {
        constructor(message: string, public type?: string, public status?: number) {
          super(message);
        }
      },
    },
  };
}

// The SDK client is normally built inside each create from bundle.authData. To
// inject the recording fetch, we swap createClient's fetch by monkeypatching the
// shared client module. Simpler: re-run the create's perform, and have the
// create build a client with the injected fetch. Since createClient takes an
// optional fetchImpl the creates do not pass, we instead exercise the SDK path
// through a create-shaped harness that calls the SDK the same way the create
// does. To keep this honest, we import the real create perform functions and
// override the global fetch for the duration of the call.

async function withFetch<T>(fetchImpl: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

interface StubBundle {
  authData: Record<string, string>;
  inputData: Record<string, unknown>;
}

/**
 * Call a create's real perform. The creates read only `request`, `stashFile`
 * and `errors` from `z`, and only `authData` and `inputData` from the bundle,
 * so the stubs carry just those; the casts here are the one place they stand in
 * for Zapier's full runtime types.
 */
function runPerform<R>(
  create: { operation: { perform: (z: ZObject, bundle: Bundle) => Promise<R> } },
  z: ReturnType<typeof makeZ>,
  bundle: StubBundle,
): Promise<R> {
  return create.operation.perform(z as unknown as ZObject, bundle as Bundle);
}

import generateInvoice from '../src/creates/generateInvoice';
import validateInvoice from '../src/creates/validateInvoice';
import parseInvoice from '../src/creates/parseInvoice';
import convertInvoice from '../src/creates/convertInvoice';
import { CONVERT_PDF_LINE, DEPTH_NOT_STATED } from '@beliq/sdk/helpers';
import { resolveGenerateTarget } from '../src/lib/options';
import { parseRecorded, parseSample, validateRecorded, validateSample } from '../src/lib/samples';
import generatedPdf from '../src/lib/recorded/generate-facturx-pdf.json';
import generatedXml from '../src/lib/recorded/generate-xrechnung-xml.json';
import generatedNoVerify from './fixtures/generate-xrechnung-xml-noverify.json';
import validatedFrance from './fixtures/live-validate-france-previous.json';
import validatedNoBadge from './fixtures/live-validate-nobadge.json';
import parsedLeftOut from './fixtures/parse-fields-left-out.json';

const AUTH = { apiKey: 'test-key-123' };

// Answers of the live API stored as they came. `src/lib/recorded/` says when
// its own were recorded. Of the copies under test/fixtures, the two
// `live-validate-*` files were recorded on 2026-10-11 and the parse answer on
// 2026-10-08, for the SDK's own tests; the generate answer with Verify off on
// 2026-10-25, for the prefilled invoice.

/** The JSON envelope generate answers with when asked for it, around `document`. */
function generateEnvelope(
  document: string | Uint8Array,
  contentType: string,
  validationResult: unknown,
  headers: Record<string, string> = {},
): FetchResponse {
  const bytes = typeof document === 'string' ? Buffer.from(document) : Buffer.from(document);
  return {
    body: JSON.stringify({
      success: true,
      data: {
        output: bytes.toString('base64'),
        contentType,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        validationResult,
      },
    }),
    headers: { 'content-type': 'application/json', ...headers },
  };
}

const xmlEnvelope = (document = '<Invoice/>') =>
  generateEnvelope(document, 'application/xml', generatedXml.validationResult, {
    'x-schematron-version': generatedXml.meta.schematronVersion,
  });
// The labels as the recorded answers carry them, so no test types a badge label.
const XML_DEPTH = generatedXml.validationResult.verificationBadgeLabel;
const PDF_DEPTH = generatedPdf.validationResult.verificationBadgeLabel;
const VALIDATE_DEPTH = validateRecorded.verificationBadgeLabel;

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]); // %PDF-1
const pdfEnvelope = () =>
  generateEnvelope(PDF_BYTES, 'application/pdf', generatedPdf.validationResult, {
    'x-pdf-kind': generatedPdf.meta.pdfKind,
  });

describe('generate_invoice mapping', () => {
  it('generates XML: POST /v1/generate with the JSON body, returns xml, meta and the verdict', async () => {
    const recorder: RecordedRequest[] = [];
    const fetchXml = recordingFetch(xmlEnvelope('<Invoice>ok</Invoice>'), recorder);

    const stashes: StashCall[] = [];
    const z = makeZ(stashes);
    const bundle = {
      authData: AUTH,
      inputData: {
        standard: 'xrechnung',
        profile: 'en16931',
        output: 'xml',
        invoice: JSON.stringify({ number: 'INV-1' }),
      },
    };

    const result = await withFetch(fetchXml, () =>
      runPerform(generateInvoice, z, bundle),
    );

    expect(recorder).toHaveLength(1);
    const req = recorder[0];
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.beliq.eu/v1/generate');
    expect(req.headers['X-API-Key']).toBe('test-key-123');
    expect(req.headers['Content-Type']).toBe('application/json');
    // Only the envelope carries the verdict's check depth.
    expect(req.headers['Accept']).toBe('application/json');
    const body = JSON.parse(req.body as string);
    // The bundle carries the field's own default profile, and XRechnung pins its
    // own, so the create drops it rather than sending a 422.
    expect(body).toEqual({
      standard: 'xrechnung',
      output: 'xml',
      invoice: { number: 'INV-1' },
    });

    expect(result).toEqual({
      xml: '<Invoice>ok</Invoice>',
      contentType: 'application/xml',
      schematronVersion: generatedXml.meta.schematronVersion,
      summary: `VALID (${XML_DEPTH}): 0 errors, 1 warning`,
      checkDepth: XML_DEPTH,
    });
    expect(stashes).toHaveLength(0);
  });

  it('generates PDF: stashes the bytes and returns the File URL, pdfKind and the verdict', async () => {
    const recorder: RecordedRequest[] = [];
    const pdfBytes = PDF_BYTES;
    const fetchImpl = recordingFetch(pdfEnvelope(), recorder);
    const stashes: StashCall[] = [];
    const z = makeZ(stashes);
    const bundle = {
      authData: AUTH,
      inputData: {
        standard: 'facturx',
        profile: 'en16931',
        output: 'pdf',
        invoice: JSON.stringify({ number: 'INV-2' }),
        pdfTemplateId: 'k3d-9mp',
        verify: 'true',
      },
    };

    const result = await withFetch(fetchImpl, () =>
      runPerform(generateInvoice, z, bundle),
    );

    const req = recorder[0];
    const body = JSON.parse(req.body as string);
    expect(body.standard).toBe('facturx');
    expect(body.output).toBe('pdf');
    expect(body.pdfTemplateId).toBe('k3d-9mp');
    // The stored template is the visual, so the built-in one is not also sent.
    expect(body.template).toBeUndefined();
    expect(body.verify).toBe(true);

    expect(stashes).toHaveLength(1);
    expect(stashes[0].filename).toBe('invoice.pdf');
    expect(stashes[0].contentType).toBe('application/pdf');
    expect(stashes[0].length).toBe(pdfBytes.length);
    expect(stashes[0].buffer.equals(Buffer.from(pdfBytes))).toBe(true);
    expect(result).toEqual({
      file: 'https://files.zapier.test/invoice.pdf',
      filename: 'invoice.pdf',
      contentType: 'application/pdf',
      sizeBytes: pdfBytes.length,
      pdfKind: 'hybrid',
      summary: `VALID (${PDF_DEPTH}): 0 errors, 0 warnings`,
      checkDepth: PDF_DEPTH,
    });
  });

  it('resolves the NLCIUS target to peppol-bis + the netherlands-nlcius profile', async () => {
    const recorder: RecordedRequest[] = [];
    const fetchImpl = recordingFetch(xmlEnvelope(), recorder);
    const z = makeZ([]);
    const bundle = {
      authData: AUTH,
      inputData: {
        standard: 'nlcius',
        // A user-set profile/pdf output is overridden by the preset.
        profile: 'en16931',
        output: 'pdf',
        invoice: JSON.stringify({ number: 'NL-1' }),
      },
    };

    await withFetch(fetchImpl, () => runPerform(generateInvoice, z, bundle));

    const body = JSON.parse(recorder[0].body as string);
    expect(body.standard).toBe('peppol-bis');
    expect(body.profile).toBe('netherlands-nlcius');
    expect(body.output).toBe('xml');
  });

  // XRechnung and Peppol BIS have no hybrid PDF. The API refuses PDF output for
  // them unless the request names a visual to render, so without `template` the
  // Output=PDF choice is a 400 nothing the user can type avoids.
  it('asks for the built-in visual when PDF is chosen and no stored template is given', async () => {
    const recorder: RecordedRequest[] = [];
    const fetchImpl = recordingFetch(pdfEnvelope(), recorder);
    const bundle = {
      authData: AUTH,
      inputData: {
        standard: 'xrechnung',
        output: 'pdf',
        invoice: JSON.stringify({ number: 'INV-3' }),
      },
    };

    await withFetch(fetchImpl, () =>
      runPerform(generateInvoice, makeZ([]), bundle),
    );

    const body = JSON.parse(recorder[0].body as string);
    expect(body.output).toBe('pdf');
    expect(body.template).toBe('standard');
  });

  // Factur-X and ZUGFeRD render their page either way, so the same field is
  // sent for them too rather than being gated on a standard list the connector
  // would then have to keep in step with the API.
  it('asks for the built-in visual on the hybrid standards as well', async () => {
    const recorder: RecordedRequest[] = [];
    const fetchImpl = recordingFetch(pdfEnvelope(), recorder);
    const bundle = {
      authData: AUTH,
      inputData: {
        standard: 'zugferd',
        output: 'pdf',
        invoice: JSON.stringify({ number: 'INV-4' }),
      },
    };

    await withFetch(fetchImpl, () =>
      runPerform(generateInvoice, makeZ([]), bundle),
    );

    expect(JSON.parse(recorder[0].body as string).template).toBe('standard');
  });

  it('names no check depth when Verify is off, because no ruleset ran', async () => {
    const answer = generatedNoVerify;
    const recorder: RecordedRequest[] = [];
    const fetchImpl = recordingFetch(
      generateEnvelope('<Invoice/>', 'application/xml', answer.validationResult),
      recorder,
    );
    const result = await withFetch(fetchImpl, () =>
      runPerform(generateInvoice, makeZ([]), {
        authData: AUTH,
        inputData: {
          standard: 'xrechnung',
          output: 'xml',
          verify: 'false',
          invoice: JSON.stringify({ number: 'INV-7' }),
        },
      }),
    );
    expect(JSON.parse(recorder[0].body as string).verify).toBe(false);
    expect(result).toMatchObject({ summary: 'NOT VALIDATED' });
    expect(result).not.toHaveProperty('checkDepth');
  });
});

describe('generate_invoice output fields', () => {
  // Zapier shows the static samples in the Zap editor when a user has no test
  // data for the step. An operation carries one `sample` (Generate's is the XML
  // shape), so a key only PDF output returns needs a sample on its own output
  // field, or the editor offers it with no value.
  const outputFields: { key: string; label?: string; sample?: unknown }[] =
    generateInvoice.operation.outputFields;
  const operationSample = new Map<string, unknown>(Object.entries(generateInvoice.operation.sample));

  async function expectEveryReturnedKeyDeclaredAndSampled(
    inputData: Record<string, unknown>,
    response: FetchResponse,
  ) {
    const result: Record<string, unknown> = await withFetch(recordingFetch(response, []), () =>
      runPerform(generateInvoice, makeZ([]), { authData: AUTH, inputData }),
    );
    expect(Object.keys(result).length).toBeGreaterThan(0);
    for (const [key, returned] of Object.entries(result)) {
      const field = outputFields.find((f) => f.key === key);
      expect(field?.label, `${key} is declared in outputFields with a label`).toBeTruthy();
      const shown = operationSample.has(key) ? operationSample.get(key) : field?.sample;
      expect(shown, `${key} has a sample value`).toBeDefined();
      if (returned !== null) {
        expect(typeof shown, `${key} sample has the type a run returns`).toBe(typeof returned);
      }
    }
  }

  it('declares and samples every key XML output returns', async () => {
    await expectEveryReturnedKeyDeclaredAndSampled(
      { standard: 'xrechnung', output: 'xml', invoice: JSON.stringify({ number: 'INV-5' }) },
      xmlEnvelope(),
    );
  });

  it('declares and samples every key PDF output returns', async () => {
    await expectEveryReturnedKeyDeclaredAndSampled(
      { standard: 'facturx', output: 'pdf', invoice: JSON.stringify({ number: 'INV-6' }) },
      pdfEnvelope(),
    );
  });
});

/** A JSON-envelope answer of a validate or parse call. */
const jsonAnswer = (data: unknown): FetchResponse => ({
  body: JSON.stringify({ success: true, data }),
  headers: { 'content-type': 'application/json' },
});

async function validateWith(data: unknown): Promise<Record<string, unknown>> {
  return withFetch(recordingFetch(jsonAnswer(data), []), () =>
    runPerform(validateInvoice, makeZ([]), {
      authData: AUTH,
      inputData: { documentText: '<Invoice/>', format: 'auto' },
    }),
  );
}

describe('validate_invoice mapping', () => {
  it('validates text input: POST /v1/validate?format=..., raw body, returns the result with its verdict', async () => {
    const recorder: RecordedRequest[] = [];
    const fetchImpl = recordingFetch(jsonAnswer(validateRecorded), recorder);
    const stashes: StashCall[] = [];
    const z = makeZ(stashes);
    const bundle = {
      authData: AUTH,
      inputData: { documentText: '<Invoice>data</Invoice>', format: 'ubl' },
    };

    const result = await withFetch(fetchImpl, () =>
      runPerform(validateInvoice, z, bundle),
    );

    expect(recorder).toHaveLength(1);
    const req = recorder[0];
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.beliq.eu/v1/validate?format=ubl');
    expect(req.headers['X-API-Key']).toBe('test-key-123');
    expect(req.headers['Content-Type']).toBe('application/xml');
    // The document text is sent as the raw request body.
    expect(new TextDecoder().decode(req.rawBody!)).toBe('<Invoice>data</Invoice>');

    // The answer is handed on as it came, with the verdict line and the depth in front.
    expect(result).toEqual({
      summary: `VALID (${VALIDATE_DEPTH}): 0 errors, 1 warning`,
      checkDepth: VALIDATE_DEPTH,
      ...validateRecorded,
    });
  });

  it('says that no depth was stated when the API sent no badge label', async () => {
    // FatturaPA FPA12 carries no tier, badge or label.
    const result = await validateWith(validatedNoBadge);
    expect(result.summary).toBe(`VALID (${DEPTH_NOT_STATED}): 0 errors, 0 warnings`);
    expect(result.checkDepth).toBe(DEPTH_NOT_STATED);
    expect(result).not.toHaveProperty('verificationBadgeLabel');
  });

  it('leads with a France CTC block, which the API reports apart from valid', async () => {
    const answer = validatedFrance as typeof validateRecorded;
    const result = await validateWith(answer);
    const lines = String(result.summary).split('\n');
    const block = answer.warnings.find((w) => w.ruleId === 'FRANCE_CTC_FINDINGS_BLOCK_TRANSMISSION');
    expect(block).toBeDefined();
    expect(answer.valid).toBe(true);
    // The API's own message first; it names every blocking id, so no id line follows.
    expect(lines[0]).toBe(block?.message);
    expect(lines[1]).toBe(`VALID (${answer.verificationBadgeLabel}): 0 errors, 10 warnings`);
    expect(lines[2]).toBe(
      'Ruleset channel: previous; the retained ruleset is served until 2027-05-16',
    );
    expect(result.franceCtcBlockingRuleIds).toEqual(answer.franceCtcBlockingRuleIds);
  });

  it('declares an output field for every key a recorded answer holds', async () => {
    const declared = new Set(validateInvoice.operation.outputFields.map((f) => f.key));
    for (const answer of [
      validateRecorded,
      validatedNoBadge,
      validatedFrance,
    ]) {
      for (const key of Object.keys(await validateWith(answer))) {
        expect(declared.has(key), `${key} is declared`).toBe(true);
      }
    }
  });

  it('samples what a run returns for the recorded answer', async () => {
    expect(await validateWith(validateRecorded)).toEqual(validateSample);
  });
});

describe('parse_invoice mapping', () => {
  it('parses text input: POST /v1/parse?format=..., returns the parse result JSON', async () => {
    const recorder: RecordedRequest[] = [];
    const parsed = { invoice: { number: 'INV-9' }, format: 'cii' };
    const fetchImpl = recordingFetch(
      { body: JSON.stringify({ success: true, data: parsed }), headers: { 'content-type': 'application/json' } },
      recorder,
    );
    const stashes: StashCall[] = [];
    const z = makeZ(stashes);
    const bundle = {
      authData: AUTH,
      inputData: { documentText: '<Invoice>cii</Invoice>', format: 'cii' },
    };

    const result = await withFetch(fetchImpl, () =>
      runPerform(parseInvoice, z, bundle),
    );

    const req = recorder[0];
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.beliq.eu/v1/parse?format=cii');
    expect(new TextDecoder().decode(req.rawBody!)).toBe('<Invoice>cii</Invoice>');
    expect(result).toEqual(parsed);
  });

  it('leaves out a field the API left out, and fills nothing in its place', async () => {
    // The API read no decimal for totalGrossAmount, so the answer has no such key.
    const answer = parsedLeftOut.data as typeof parseRecorded;
    const result = await withFetch(recordingFetch(jsonAnswer(answer), []), () =>
      runPerform(parseInvoice, makeZ([]), {
        authData: AUTH,
        inputData: { documentText: '<Invoice/>', format: 'auto' },
      }),
    );
    expect(result).toEqual(answer);
    expect(result.invoice).not.toHaveProperty('totalGrossAmount');
  });

  it('samples the recorded answer, which a run hands on as it came', async () => {
    const result = await withFetch(recordingFetch(jsonAnswer(parseRecorded), []), () =>
      runPerform(parseInvoice, makeZ([]), {
        authData: AUTH,
        inputData: { documentText: '<Invoice/>', format: 'auto' },
      }),
    );
    expect(result).toEqual(parseSample);
  });
});

describe('convert_invoice mapping', () => {
  it('converts to UBL: POST /v1/convert?targetFormat=ubl, stashes XML, passes lostElements through', async () => {
    const recorder: RecordedRequest[] = [];
    const xmlBytes = new TextEncoder().encode('<Invoice>ubl</Invoice>');
    const fetchImpl = recordingFetch(
      {
        body: xmlBytes,
        headers: {
          'content-type': 'application/xml',
          'x-lost-elements-count': '2',
          'x-lost-elements': JSON.stringify(['BT-10', 'BT-11']),
        },
      },
      recorder,
    );
    const stashes: StashCall[] = [];
    const z = makeZ(stashes);
    const bundle = {
      authData: AUTH,
      inputData: { documentText: '<Invoice>cii</Invoice>', targetFormat: 'ubl', profile: 'en16931' },
    };

    const result = await withFetch(fetchImpl, () =>
      runPerform(convertInvoice, z, bundle),
    );

    const req = recorder[0];
    expect(req.method).toBe('POST');
    // profile is not attached for a non-facturx target (SDK gates targetProfile).
    expect(req.url).toBe('https://api.beliq.eu/v1/convert?targetFormat=ubl');
    expect(new TextDecoder().decode(req.rawBody!)).toBe('<Invoice>cii</Invoice>');

    expect(stashes).toHaveLength(1);
    expect(stashes[0].filename).toBe('invoice.ubl.xml');
    expect(stashes[0].contentType).toBe('application/xml');
    expect(result.file).toBe('https://files.zapier.test/invoice.ubl.xml');
    expect(result.lostElementsCount).toBe(2);
    expect(result.lostElements).toEqual(['BT-10', 'BT-11']);
  });

  it('names a Factur-X answer by its content type: CII XML from an XML source', async () => {
    const stashes: StashCall[] = [];
    const fetchImpl = recordingFetch(
      {
        body: new TextEncoder().encode('<rsm:CrossIndustryInvoice/>'),
        headers: { 'content-type': 'application/xml', 'x-lost-elements-count': '0' },
      },
      [],
    );
    const result = await withFetch(fetchImpl, () =>
      runPerform(convertInvoice, makeZ(stashes), {
        authData: AUTH,
        inputData: { documentText: '<Invoice>ubl</Invoice>', targetFormat: 'facturx' },
      }),
    );
    expect(stashes[0].filename).toBe('invoice.facturx.xml');
    expect(result.filename).toBe('invoice.facturx.xml');
    expect(result.contentType).toBe('application/xml');
    expect(result).not.toHaveProperty('pdfNote');
  });

  it('converts to Factur-X: attaches targetProfile and names the file invoice.pdf', async () => {
    const recorder: RecordedRequest[] = [];
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    const fetchImpl = recordingFetch(
      { body: pdfBytes, headers: { 'content-type': 'application/pdf', 'x-lost-elements-count': '0' } },
      recorder,
    );
    const stashes: StashCall[] = [];
    const z = makeZ(stashes);
    const bundle = {
      authData: AUTH,
      inputData: { documentText: '<Invoice>ubl</Invoice>', targetFormat: 'facturx', profile: 'en16931' },
    };

    const result = await withFetch(fetchImpl, () =>
      runPerform(convertInvoice, z, bundle),
    );

    const req = recorder[0];
    const url = new URL(req.url);
    expect(url.pathname).toBe('/v1/convert');
    expect(url.searchParams.get('targetFormat')).toBe('facturx');
    expect(url.searchParams.get('targetProfile')).toBe('en16931');

    expect(stashes[0].filename).toBe('invoice.pdf');
    expect(stashes[0].contentType).toBe('application/pdf');
    expect(result.filename).toBe('invoice.pdf');
    expect(result.lostElementsCount).toBe(0);
    // No documented field says which path made the PDF, so the note names both.
    expect(result.pdfNote).toBe(CONVERT_PDF_LINE);
  });
});

describe('generate_invoice profile gating', () => {
  // `choices` are static per field, so the Profile dropdown offers the Factur-X
  // family for every standard. The create is the only place that can refuse a
  // pair the engine answers with 422 PROFILE_STANDARD_MISMATCH.
  async function bodyFor(inputData: Record<string, unknown>) {
    const recorder: RecordedRequest[] = [];
    const fetchXml = recordingFetch(xmlEnvelope(), recorder);
    const z = makeZ([]);
    await withFetch(fetchXml, () =>
      runPerform(generateInvoice, z, {
        authData: AUTH,
        inputData: { output: 'xml', invoice: JSON.stringify({ number: 'INV-1' }), ...inputData },
      }),
    );
    return JSON.parse(recorder[0].body as string);
  }

  it('drops the default profile on Peppol BIS, which pins its own', async () => {
    expect(await bodyFor({ standard: 'peppol-bis', profile: 'en16931' })).not.toHaveProperty(
      'profile',
    );
  });

  it('drops the France CTC overlay profile on ZUGFeRD', async () => {
    expect(await bodyFor({ standard: 'zugferd', profile: 'extended-ctc-fr' })).not.toHaveProperty(
      'profile',
    );
  });

  it('keeps a profile the standard does accept', async () => {
    expect(await bodyFor({ standard: 'facturx', profile: 'extended-ctc-fr' })).toMatchObject({
      profile: 'extended-ctc-fr',
    });
  });

  it('lets the NLCIUS preset pin the profile Peppol BIS needs', async () => {
    expect(await bodyFor({ standard: 'nlcius', profile: 'en16931' })).toMatchObject({
      standard: 'peppol-bis',
      profile: 'netherlands-nlcius',
    });
  });

  it('defaults Verify on, so an invalid document fails instead of returning', () => {
    const verify = generateInvoice.operation.inputFields.find(
      (f) => (f as { key?: string }).key === 'verify',
    ) as { default?: string };
    expect(verify.default).toBe('true');
  });

  // A preset that forces its output wins over the Output field, so that field
  // has to say so, or the user's choice is dropped without a word.
  it('names every standard that overrides Output in the Output help text', () => {
    const fields = generateInvoice.operation.inputFields as {
      key?: string;
      choices?: Record<string, string>;
      helpText?: string;
    }[];
    const standard = fields.find((f) => f.key === 'standard')!;
    const output = fields.find((f) => f.key === 'output')!;
    const forcing = Object.entries(standard.choices!).flatMap(([value, label]) => {
      const forced = resolveGenerateTarget(value).output;
      return forced ? [`${label} always returns ${forced.toUpperCase()}`] : [];
    });
    expect(forcing).toEqual(['NLCIUS always returns XML']);
    for (const sentence of forcing) expect(output.helpText).toContain(sentence);
  });
});
