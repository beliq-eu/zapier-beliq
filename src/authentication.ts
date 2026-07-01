import type { Authentication, ZObject } from 'zapier-platform-core';
import { BeliqApiError } from '@beliq/sdk';
import { createClient, mapError, type BeliqAuthData } from './lib/client';

// The credential test calls GET /v1/me, which returns the account context and
// consumes no quota. A 200 means the key is valid; a 401/403 means it is not. A
// working test is mandatory for App Directory review.
const test = async (z: ZObject, bundle: { authData: BeliqAuthData }) => {
  const client = createClient(bundle.authData);
  try {
    return await client.me();
  } catch (error) {
    if (error instanceof BeliqApiError && (error.status === 401 || error.status === 403)) {
      throw new z.errors.Error('The beliq API key is invalid.', 'AuthenticationError', error.status);
    }
    throw mapError(error);
  }
};

const authentication: Authentication = {
  type: 'custom',
  fields: [
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      helpText:
        'Your beliq API key. Create one in the [beliq dashboard](https://dashboard.beliq.eu) under API Keys.',
    },
  ],
  test,
};

export default authentication;
