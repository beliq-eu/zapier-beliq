import type { Bundle, ZObject } from 'zapier-platform-core';

// Document IO between Zapier inputs and the SDK. The SDK owns the wire format;
// these only move bytes in and out of the Zapier runtime. A raw-input create
// (validate / parse / convert) reads either a hydrated file pointer or pasted
// text; a document-producing create stashes its bytes to a Zapier File URL.

/**
 * Read the raw document bytes for a raw-input create. `documentFile` is a URL
 * or a hydrated file pointer (Zapier resolves an upstream file field to a URL);
 * when present it is fetched. Otherwise the pasted `documentText` is used. The
 * SDK sniffs PDF-vs-XML from the bytes, so no content type is returned here.
 */
export async function resolveDocument(z: ZObject, bundle: Bundle): Promise<string | Buffer> {
  const input = bundle.inputData ?? {};
  const fileRef = typeof input.documentFile === 'string' ? input.documentFile.trim() : '';

  if (fileRef) {
    const response = await z.request({ url: fileRef, raw: true });
    return response.buffer();
  }

  const text = typeof input.documentText === 'string' ? input.documentText.trim() : '';
  if (text) {
    return text;
  }

  throw new z.errors.Error(
    'Provide a document: paste the invoice XML in Document Text, or map a file into Document File.',
    'InvalidInput',
    400,
  );
}

/**
 * Stash a document-producing create's bytes to a Zapier-hosted File URL so
 * downstream steps can attach or upload it, and return that URL.
 */
export async function stashDocument(
  z: ZObject,
  bytes: Uint8Array,
  filename: string,
  contentType: string,
): Promise<string> {
  const buffer = Buffer.from(bytes);
  return z.stashFile(buffer, buffer.length, filename, contentType);
}
