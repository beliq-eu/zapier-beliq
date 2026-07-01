import { describe, expect, it } from 'vitest';
import { Beliq } from '@beliq/sdk';

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

import generateInvoice from '../src/creates/generateInvoice';
import validateInvoice from '../src/creates/validateInvoice';
import parseInvoice from '../src/creates/parseInvoice';
import convertInvoice from '../src/creates/convertInvoice';

const AUTH = { apiKey: 'test-key-123' };

describe('generate_invoice mapping', () => {
  it('generates XML: POST /v1/generate with the JSON body, returns xml + meta', async () => {
    const recorder: RecordedRequest[] = [];
    // generate's output is binary: the response body IS the document, so return
    // XML bytes with the header metadata the create surfaces.
    const fetchXml = recordingFetch(
      {
        body: '<Invoice>ok</Invoice>',
        headers: {
          'content-type': 'application/xml',
          'x-schematron-version': 'xr-3.0.2',
          'x-output-envelope': 'ubl',
        },
      },
      recorder,
    );

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
      (generateInvoice.operation.perform as any)(z, bundle),
    );

    expect(recorder).toHaveLength(1);
    const req = recorder[0];
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.beliq.eu/v1/generate');
    expect(req.headers['X-API-Key']).toBe('test-key-123');
    expect(req.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(req.body as string);
    expect(body).toEqual({
      standard: 'xrechnung',
      output: 'xml',
      invoice: { number: 'INV-1' },
      profile: 'en16931',
    });

    expect(result.xml).toBe('<Invoice>ok</Invoice>');
    expect(result.contentType).toBe('application/xml');
    expect(result.schematronVersion).toBe('xr-3.0.2');
    expect(result.outputEnvelope).toBe('ubl');
    expect(stashes).toHaveLength(0);
  });

  it('generates PDF: stashes the bytes and returns the File URL + pdfKind', async () => {
    const recorder: RecordedRequest[] = [];
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]); // %PDF-1
    const fetchImpl = recordingFetch(
      { body: pdfBytes, headers: { 'content-type': 'application/pdf', 'x-pdf-kind': 'facturx' } },
      recorder,
    );
    const stashes: StashCall[] = [];
    const z = makeZ(stashes);
    const bundle = {
      authData: AUTH,
      inputData: {
        standard: 'facturx',
        profile: 'en16931',
        output: 'pdf',
        invoice: JSON.stringify({ number: 'INV-2' }),
        pdfTemplateId: 'tmpl_abc',
        verify: 'true',
      },
    };

    const result = await withFetch(fetchImpl, () =>
      (generateInvoice.operation.perform as any)(z, bundle),
    );

    const req = recorder[0];
    const body = JSON.parse(req.body as string);
    expect(body.standard).toBe('facturx');
    expect(body.output).toBe('pdf');
    expect(body.pdfTemplateId).toBe('tmpl_abc');
    expect(body.verify).toBe(true);

    expect(stashes).toHaveLength(1);
    expect(stashes[0].filename).toBe('invoice.pdf');
    expect(stashes[0].contentType).toBe('application/pdf');
    expect(stashes[0].length).toBe(pdfBytes.length);
    expect(result.file).toBe('https://files.zapier.test/invoice.pdf');
    expect(result.filename).toBe('invoice.pdf');
    expect(result.pdfKind).toBe('facturx');
    expect(result.sizeBytes).toBe(pdfBytes.length);
  });
});

describe('validate_invoice mapping', () => {
  it('validates text input: POST /v1/validate?format=..., raw body, returns the result JSON', async () => {
    const recorder: RecordedRequest[] = [];
    const fetchImpl = recordingFetch(
      {
        body: JSON.stringify({ success: true, data: { valid: true, format: 'ubl', errors: [], warnings: [] } }),
        headers: { 'content-type': 'application/json' },
      },
      recorder,
    );
    const stashes: StashCall[] = [];
    const z = makeZ(stashes);
    const bundle = {
      authData: AUTH,
      inputData: { documentText: '<Invoice>data</Invoice>', format: 'ubl' },
    };

    const result = await withFetch(fetchImpl, () =>
      (validateInvoice.operation.perform as any)(z, bundle),
    );

    expect(recorder).toHaveLength(1);
    const req = recorder[0];
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.beliq.eu/v1/validate?format=ubl');
    expect(req.headers['X-API-Key']).toBe('test-key-123');
    expect(req.headers['Content-Type']).toBe('application/xml');
    // The document text is sent as the raw request body.
    expect(new TextDecoder().decode(req.rawBody!)).toBe('<Invoice>data</Invoice>');

    expect(result).toEqual({ valid: true, format: 'ubl', errors: [], warnings: [] });
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
      (parseInvoice.operation.perform as any)(z, bundle),
    );

    const req = recorder[0];
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.beliq.eu/v1/parse?format=cii');
    expect(new TextDecoder().decode(req.rawBody!)).toBe('<Invoice>cii</Invoice>');
    expect(result).toEqual(parsed);
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
      (convertInvoice.operation.perform as any)(z, bundle),
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
      (convertInvoice.operation.perform as any)(z, bundle),
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
  });
});
