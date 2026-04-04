CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE sites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  domain     VARCHAR(255) NOT NULL UNIQUE,
  api_key    VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE users (
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

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_reset_token ON users(reset_token) WHERE reset_token IS NOT NULL;

CREATE TABLE funnels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id    UUID REFERENCES sites(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  steps      JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Migration helper: run this if upgrading from old schema
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255) DEFAULT '';
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(255) DEFAULT '';
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMPTZ;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INTEGER DEFAULT 0;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
