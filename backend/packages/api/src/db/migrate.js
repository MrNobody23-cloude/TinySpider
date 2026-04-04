/**
 * Database Migration Script
 * 
 * Run: node src/db/migrate.js
 * 
 * This script creates or upgrades the PostgreSQL schema.
 * It is safe to run multiple times (idempotent).
 */

import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DB || 'insightdb',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres'
});

const migrations = [
    {
        name: '001_create_extensions',
        sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
    },
    {
        name: '002_create_sites',
        sql: `
            CREATE TABLE IF NOT EXISTS sites (
                id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name       VARCHAR(255) NOT NULL,
                domain     VARCHAR(255) NOT NULL UNIQUE,
                api_key    VARCHAR(64) NOT NULL UNIQUE,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        `
    },
    {
        name: '003_create_users',
        sql: `
            CREATE TABLE IF NOT EXISTS users (
                id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email              VARCHAR(255) NOT NULL UNIQUE,
                password_hash      VARCHAR(255) NOT NULL,
                full_name          VARCHAR(255) DEFAULT '',
                company_name       VARCHAR(255) DEFAULT '',
                created_at         TIMESTAMPTZ DEFAULT now(),
                updated_at         TIMESTAMPTZ DEFAULT now(),
                last_login         TIMESTAMPTZ,
                is_active          BOOLEAN DEFAULT true,
                reset_token        VARCHAR(255),
                reset_token_expiry TIMESTAMPTZ,
                failed_login_count INTEGER DEFAULT 0,
                locked_until       TIMESTAMPTZ
            );
        `
    },
    {
        name: '004_upgrade_users_add_columns',
        sql: `
            ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255) DEFAULT '';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(255) DEFAULT '';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
            ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMPTZ;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INTEGER DEFAULT 0;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
        `
    },
    {
        name: '005_create_users_indexes',
        sql: `
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token) WHERE reset_token IS NOT NULL;
        `
    },
    {
        name: '006_create_funnels',
        sql: `
            CREATE TABLE IF NOT EXISTS funnels (
                id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                site_id    UUID REFERENCES sites(id) ON DELETE CASCADE,
                name       VARCHAR(255) NOT NULL,
                steps      JSONB NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        `
    }
];

async function runMigrations() {
    console.log('🔄 Running database migrations...\n');

    for (const migration of migrations) {
        try {
            await pool.query(migration.sql);
            console.log(`  ✅ ${migration.name}`);
        } catch (err) {
            console.error(`  ❌ ${migration.name}: ${err.message}`);
        }
    }

    console.log('\n✅ Migrations complete.');
    await pool.end();
}

runMigrations().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
