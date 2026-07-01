import { version as platformVersion } from 'zapier-platform-core';
import authentication from './authentication';
import generateInvoice from './creates/generateInvoice';
import validateInvoice from './creates/validateInvoice';
import parseInvoice from './creates/parseInvoice';
import convertInvoice from './creates/convertInvoice';

const { version } = require('../package.json');

const App = {
  version,
  platformVersion,

  // We read and coerce raw inputs ourselves (JSON parsing, file-vs-text
  // resolution), so keep the raw input rather than letting Zapier prune it.
  flags: { cleanInputData: false },

  authentication,

  // The SDK injects the X-API-Key header on every request, so no auth
  // middleware runs here.
  beforeRequest: [],
  afterResponse: [],

  creates: {
    [generateInvoice.key]: generateInvoice,
    [validateInvoice.key]: validateInvoice,
    [parseInvoice.key]: parseInvoice,
    [convertInvoice.key]: convertInvoice,
  },
};

export = App;
