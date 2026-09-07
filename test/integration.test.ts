import { beforeAll, describe, expect, it } from 'vitest';
import { Beliq } from '@beliq/sdk';
import generateInvoice from '../src/creates/generateInvoice';

// Live smoke test against the real beliq API. Skipped unless BELIQ_API_KEY is
// set. It drives the SDK directly the same way the creates do, which validates
// the whole field-mapping + wire chain against the live contract. The
// z.stashFile delivery path runs only on Zapier, so it is verified in-product
// during the push/connect step, not here.
const API_KEY = process.env.BELIQ_API_KEY;

// The prefilled Invoice Data is what a user's first run sends, so the smoke
// drives that exact object rather than a second copy that can drift from it.
const sampleInvoice = JSON.parse(
  ((generateInvoice.operation.inputFields as any[]).find((f) => f.key === 'invoice')!.default) as string,
);

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
