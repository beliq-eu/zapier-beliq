import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The live smoke tests in creates.test.ts hit the real beliq API and stash
    // files; give them room and run files serially to stay within the API rate
    // limit.
    testTimeout: 60000,
    fileParallelism: false,
  },
});
