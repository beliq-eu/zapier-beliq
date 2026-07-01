import { beforeAll, describe, expect, it } from 'vitest';
import { Beliq } from '@beliq/sdk';

// Live smoke test against the real beliq API. Skipped unless BELIQ_API_KEY is
// set (so it never runs in CI). It drives the SDK directly the same way the
// creates do, which validates the whole field-mapping + wire chain against the
// live contract. The z.stashFile delivery path runs only on Zapier, so it is
// verified in-product during the push/connect step, not here.
const API_KEY = process.env.BELIQ_API_KEY;

const sampleInvoice = {
  number: 'INV-SMOKE-1',
  issueDate: '2026-06-04',
  dueDate: '2026-07-04',
  currencyCode: 'EUR',
  seller: {
    name: 'Acme GmbH',
    address: { line1: 'Hauptstr. 1', city: 'Berlin', postalCode: '10115', countryCode: 'DE' },
    taxId: 'DE123456789',
  },
  buyer: {
    name: 'Buyer SARL',
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
};

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
      profile: 'en16931',
      output: 'xml',
      invoice: sampleInvoice,
    });
    expect(result.contentType).toContain('xml');
    expect(result.xml).toBeTruthy();
    expect(result.xml).toContain('INV-SMOKE-1');
  });

  it('validate accepts a generated document', async () => {
    const generated = await client.generate({
      standard: 'xrechnung',
      profile: 'en16931',
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
      profile: 'en16931',
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
