import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/errors.ts',
        'src/lib/ownership.ts',
        'src/lib/shares.ts',
        'src/lib/occupancy.ts',
        'src/lib/contact-duplicates.ts',
        'src/lib/files.ts',
        'src/lib/upload.ts',
        'src/lib/geocode.ts',
        'src/lib/gaps.ts',
        'src/lib/dates.ts',
        'src/lib/show-error.ts',
        'src/lib/leases.ts',
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
