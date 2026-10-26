import { beforeAll, describe, expect, it } from 'vitest';
import type { Bundle, ZObject } from 'zapier-platform-core';
import { Beliq } from '@beliq/sdk';
import convertInvoice from '../src/creates/convertInvoice';
import generateInvoice from '../src/creates/generateInvoice';
import { prefilledInvoice } from './prefilled-invoice';

// Live smoke test against the real beliq API. Skipped unless BELIQ_API_KEY is
// set. It drives the SDK directly the same way the creates do, which validates
// the whole field-mapping + wire chain against the live contract. The
// z.stashFile delivery path runs only on Zapier, so it is verified in-product
// during the push/connect step, not here.
const API_KEY = process.env.BELIQ_API_KEY;

const sampleInvoice = prefilledInvoice();

// The creates read `errors` and `stashFile` from `z`; the two runs below return
// XML, which is not stashed for Generate and is stashed under its name for Convert.
const z = {
  stashFile: async (_buffer: Buffer, _length: number, filename: string) => `stash://${filename}`,
  errors: { Error },
} as unknown as ZObject;
const bundle = (inputData: Record<string, unknown>) =>
  ({ authData: { apiKey: API_KEY }, inputData }) as unknown as Bundle;

describe.skipIf(!API_KEY)('beliq live API', () => {
  let client: Beliq;
  beforeAll(() => {
    client = new Beliq({ apiKey: API_KEY! });
  });

  it('me() returns account context', async () => {
    const account = await client.me();
    expect(account).toBeTruthy();
  });

  it('generate (XRechnung / XML) returns valid XML', async () => {
    const result = await client.generate({
      standard: 'xrechnung',
      output: 'xml',
      invoice: sampleInvoice,
    });
    expect(result.contentType).toContain('xml');
    expect(result.xml).toBeTruthy();
    expect(result.xml).toContain(sampleInvoice.number);
  });

  it('validate accepts a generated document', async () => {
    const generated = await client.generate({
      standard: 'xrechnung',
      output: 'xml',
      invoice: sampleInvoice,
    });
    const validation = await client.validate(generated.xml!, { format: 'auto' });
    expect(validation).toHaveProperty('valid');
    expect(validation).toHaveProperty('format');
  });

  it('parse extracts structured fields', async () => {
    const generated = await client.generate({
      standard: 'xrechnung',
      output: 'xml',
      invoice: sampleInvoice,
    });
    const parsed = await client.parse(generated.xml!, { format: 'auto' });
    expect(parsed).toHaveProperty('invoice');
  });

  it('Generate Invoice returns the check depth of the verdict the API sent', async () => {
    const result: Record<string, unknown> = await generateInvoice.operation.perform(
      z,
      bundle({ standard: 'xrechnung', output: 'xml', invoice: JSON.stringify(sampleInvoice) }),
    );
    expect(result.xml).toContain(sampleInvoice.number);
    expect(typeof result.checkDepth).toBe('string');
    expect(String(result.summary).startsWith(`VALID (${String(result.checkDepth)}): `)).toBe(true);
  });

  it('Convert Invoice names the CII XML a Factur-X target returns for an XML source', async () => {
    const generated = await client.generate({ standard: 'xrechnung', output: 'xml', invoice: sampleInvoice });
    const result = await convertInvoice.operation.perform(
      z,
      bundle({ documentText: generated.xml, targetFormat: 'facturx', profile: 'en16931' }),
    );
    expect(result.contentType).toBe('application/xml');
    expect(result.filename).toBe('invoice.facturx.xml');
    expect(result).not.toHaveProperty('pdfNote');
  });

  it('convert to UBL returns bytes and lost-element metadata', async () => {
    const generated = await client.generate({
      standard: 'facturx',
      profile: 'en16931',
      output: 'xml',
      invoice: sampleInvoice,
    });
    const converted = await client.convert(generated.xml!, { targetFormat: 'ubl' });
    expect(converted.bytes.length).toBeGreaterThan(0);
    expect(converted.meta).toHaveProperty('lostElementsCount');
  });
});
