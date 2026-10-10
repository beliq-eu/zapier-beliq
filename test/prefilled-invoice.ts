import type { Invoice } from '@beliq/sdk';
import generateInvoice from '../src/creates/generateInvoice';

/**
 * The prefilled Invoice Data is what a user's first run sends, so a test drives
 * that exact object rather than a second copy that can drift from it.
 */
export function prefilledInvoice(): Invoice {
  const field = generateInvoice.operation.inputFields.find((f) => f.key === 'invoice');
  if (typeof field?.default !== 'string') throw new Error('the invoice field has no prefilled default');
  return JSON.parse(field.default) as Invoice;
}
