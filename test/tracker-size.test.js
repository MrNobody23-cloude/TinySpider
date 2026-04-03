import fs from 'node:fs';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';

import { describe, expect, test } from 'vitest';

const gzipAsync = promisify(gzip);

describe('tracker bundle size', () => {
    test('tracker build is under 5KB gzipped', async () => {
        const file = fs.readFileSync('packages/tracker/dist/insight.min.js');
        const compressed = await gzipAsync(file);
        expect(compressed.length).toBeLessThan(5120);
    });
});
