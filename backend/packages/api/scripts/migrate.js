import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
    const config = {
        host: process.env.POSTGRES_HOST || '127.0.0.1',
        port: Number(process.env.POSTGRES_PORT || 5432),
        database: process.env.POSTGRES_DB || 'insightdb',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres'
    };

    console.log('🗄️  TinySpider PostgreSQL Migration');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Host: ${config.host}:${config.port}`);
    console.log(`   Database: ${config.database}`);
    console.log(`   User: ${config.user}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const pool = new pg.Pool(config);

    try {
        // Test connection
        const client = await pool.connect();
        console.log('✅ Connected to PostgreSQL');
        client.release();

        // Read and execute schema
        const schemaPath = join(__dirname, '..', 'src', 'db', 'postgres-schema.sql');
        const schema = readFileSync(schemaPath, 'utf-8');

        // Split by semicolons and execute each statement
        const statements = schema
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            try {
                await pool.query(statement);
                // Extract table/extension name for logging
                const match = statement.match(/CREATE\s+(?:TABLE|EXTENSION|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?(\S+)/i);
                const name = match ? match[1] : 'statement';
                console.log(`✅ Executed: ${name}`);
            } catch (err) {
                if (err.code === '42710' || err.code === '42P07') {
                    // Already exists — skip
                    const match = statement.match(/CREATE\s+(?:TABLE|EXTENSION|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?(\S+)/i);
                    const name = match ? match[1] : 'statement';
                    console.log(`⏭️  Already exists: ${name}`);
                } else {
                    throw err;
                }
            }
        }

        console.log('\n✅ PostgreSQL migration complete!\n');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

async function migrateClickHouse() {
    console.log('📊 TinySpider ClickHouse Migration');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const url = process.env.CLICKHOUSE_URL || 'http://127.0.0.1:8123';
    const username = process.env.CLICKHOUSE_USERNAME || 'default';
    const password = process.env.CLICKHOUSE_PASSWORD || '';
    const database = process.env.CLICKHOUSE_DATABASE || 'default';

    console.log(`   URL: ${url}`);
    console.log(`   Database: ${database}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const schemaPath = join(__dirname, '..', 'src', 'db', 'clickhouse-schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Split by semicolons
    const statements = schema
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    for (const statement of statements) {
        try {
            const queryUrl = `${url}/?database=${database}&user=${username}&password=${encodeURIComponent(password)}`;
            const response = await fetch(queryUrl, {
                method: 'POST',
                body: statement,
                headers: { 'Content-Type': 'text/plain' }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }

            const match = statement.match(/CREATE\s+(?:TABLE|MATERIALIZED\s+VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(\S+)/i);
            const name = match ? match[1] : 'statement';
            console.log(`✅ Executed: ${name}`);
        } catch (err) {
            console.error(`❌ Failed: ${err.message}`);
        }
    }

    console.log('\n✅ ClickHouse migration complete!\n');
}

async function main() {
    const target = process.argv[2] || 'all';

    if (target === 'all' || target === 'postgres') {
        await migrate();
    }

    if (target === 'all' || target === 'clickhouse') {
        await migrateClickHouse();
    }

    if (target !== 'all' && target !== 'postgres' && target !== 'clickhouse') {
        console.log('Usage: node migrate.js [all|postgres|clickhouse]');
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
