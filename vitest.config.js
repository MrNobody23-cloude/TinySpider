import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['test/**/*.test.js', 'packages/api/test/**/*.test.js']
    }
});
