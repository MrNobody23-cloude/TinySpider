import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const file = readFileSync(new URL('../dist/insight.min.js', import.meta.url));
const gz = gzipSync(file);

if (gz.length >= 5120) {
    console.error(`Tracker bundle too large: ${gz.length} bytes gzipped (limit: 5120)`);
    process.exit(1);
}

console.log(`Tracker gzip size OK: ${gz.length} bytes`);
