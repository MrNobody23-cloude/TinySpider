# Security & Compliance

## Overview

TinySpider is designed with security and privacy as core principles. All data stays on your infrastructure, and no third-party tracking services are used.

## Security Principles

1. **Privacy First**: No external data sharing
2. **Data Ownership**: Your data stays on your servers
3. **Encryption**: HTTPS/SSL for data in transit
4. **Hashing**: IP addresses hashed, not stored plaintext
5. **Rate Limiting**: Protection against abuse
6. **Validation**: All inputs validated
7. **Authentication**: JWT-based access control

## HTTPS/SSL Configuration

### Enforce HTTPS

```nginx
# In nginx.conf
server {
    listen 80;
    server_name analytics.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name analytics.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

### Certificate Management

```bash
# Let's Encrypt with Certbot
sudo certbot certonly --standalone -d analytics.example.com

# Auto-renewal
sudo certbot renew --quiet --deploy-hook "docker-compose restart nginx"
```

## Data Protection

### IP Address Hashing

IP addresses are never stored in plaintext:

```javascript
// backend/packages/api/src/services.js
import { createHash } from 'node:crypto';

function hashIp(ip, salt) {
    return createHash('sha256')
        .update(ip + salt)
        .digest('hex');
}
```

The `IP_HASH_SALT` must be kept secret and consistent.

### Password Security

Passwords are hashed with bcrypt:

```javascript
import bcrypt from 'bcrypt';

// Hash during registration
const passwordHash = await bcrypt.hash(password, 12);

// Verify during login
const isValid = await bcrypt.compare(password, passwordHash);
```

Use at least `BCRYPT_ROUNDS=12` for production.

### Database Encryption

#### PostgreSQL

Enable encryption at rest:

```sql
-- During installation
initdb --data-checksums

-- Or use encrypted filesystem
sudo cryptsetup luksFormat /dev/sdX
sudo cryptsetup luksOpen /dev/sdX postgres_data
```

#### ClickHouse

Enable disk encryption:

```xml
<!-- In config.xml -->
<encryption_codec>
    <aes_256_gcm_siv>
        <key_hex>your_hex_key_here</key_hex>
    </aes_256_gcm_siv>
</encryption_codec>
```

## API Security

### Rate Limiting

Prevent abuse:

```javascript
// Configured in app.js
await app.register(rateLimit, {
    global: false,
    routes: {
        '/collect': {
            max: 100,
            timeWindow: '1 minute'
        }
    }
});
```

### CORS Configuration

Control which domains can access your API:

```env
# .env
API_CORS_ORIGINS=https://example.com,https://www.example.com

# NOT recommended (allows all):
# API_CORS_ORIGINS=*
```

### Input Validation

All API inputs validated with JSON schemas:

```javascript
// Example: collect route
const collectSchema = {
    body: {
        type: 'object',
        required: ['site_id', 'event_type', 'url'],
        properties: {
            site_id: { type: 'string', minLength: 1, maxLength: 255 },
            event_type: { type: 'string', enum: ['pageview', 'click', 'custom'] },
            url: { type: 'string', minLength: 1, maxLength: 2048 },
            click_x: { type: 'number', minimum: 0, maximum: 1 }
        }
    }
};
```

### API Keys Management

```sql
-- Generate secure API key
SELECT encode(gen_random_bytes(32), 'hex') as api_key;

-- Store in sites table
UPDATE sites SET api_key = 'generated_key' WHERE id = 'site_id';

-- Use in requests
curl -H "X-API-Key: generated_key" https://api.example.com/api/stats/timeseries
```

## Authentication Security

### JWT Configuration

```javascript
// Secure JWT setup
import jwt from 'jsonwebtoken';

function signToken(payload) {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters');
    }

    return jwt.sign(payload, secret, {
        expiresIn: '7d',           // Expiration time
        algorithm: 'HS256'         // Algorithm
    });
}

function verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
}
```

### Session Security

- Token expiration: 7 days
- Refresh tokens: Implement rotation
- Secure cookies: HttpOnly, Secure flags

```javascript
// Setting secure cookies
reply.cookie('token', token, {
    httpOnly: true,     // Not accessible via JavaScript
    secure: true,       // HTTPS only
    sameSite: 'strict', // CSRF protection
    maxAge: 604800000   // 7 days in milliseconds
});
```

## Database Security

### PostgreSQL Security

```sql
-- Create restricted user
CREATE USER analytics_app WITH PASSWORD 'strong_password';

-- Grant minimal privileges
GRANT USAGE ON SCHEMA public TO analytics_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO analytics_app;

-- Restrict access by IP
# In pg_hba.conf
host    insightdb    analytics_app    192.168.1.0/24    md5
host    insightdb    analytics_app    fedcba98::1/128   md5
```

### ClickHouse Security

```sql
-- Create user with limited privileges
CREATE USER analytics_user IDENTIFIED BY 'password' WITH default_database = default;

-- Grant specific permissions
GRANT SELECT ON events TO analytics_user;
GRANT INSERT ON events TO analytics_user;
```

### Redis Security

```bash
# Require authentication
redis-cli CONFIG SET requirepass "your_secure_password"

# Add to redis.conf
requirepass your_secure_password
```

## Network Security

### Firewall Rules

```bash
# Allow only necessary ports
# 80: HTTP (redirect to HTTPS)
# 443: HTTPS
# 3000: API (internal only)
# 5173: Dashboard (internal only)
# 8123: ClickHouse (internal only)
# 5432: PostgreSQL (internal only)
# 6379: Redis (internal only)
```

### VPC/Network Isolation

- Put databases in private subnet
- API behind load balancer
- Dashboard in separate tier
- Use security groups for access control

## Secrets Management

### Environment Variables

```bash
# Never commit to git
.env          # ← Add to .gitignore
.env.local    # ← Personal overrides
.env.prod     # ← Production secrets

# Secure file permissions
chmod 600 .env
chmod 600 .env.prod
```

### Secret Rotation

```bash
#!/bin/bash
# Rotate secrets
OLD_SECRET=$JWT_SECRET

# Generate new secrets
NEW_JWT_SECRET=$(openssl rand -base64 32)
NEW_SALT=$(openssl rand -hex 32)

# Update .env
sed -i "s/JWT_SECRET=.*/JWT_SECRET=$NEW_JWT_SECRET/g" .env

# Re-hash existing passwords with new salt (if using salt)
# ... migration script ...

# Restart services
docker-compose restart api
```

## Bot Detection Security

Multi-layer bot detection prevents invalid traffic:

```javascript
// Layer 1: User-Agent signatures
if (BOT_SIGNATURES.some(regex => regex.test(userAgent))) {
    isBot = true;
}

// Layer 2: Behavioral markers
if (navigator.webdriver === true) {
    isBot = true;
}

// Layer 3: Missing headers
if (!acceptLanguage) {
    isBot = true;
}

// Layer 4: Honeypot
if (honeypotImageFailed) {
    isBot = true;
}
```

## Data Privacy (GDPR Compliance)

### Right to Deletion

```sql
-- Delete user data
DELETE FROM events WHERE ip_hash = 'hashed_ip';
DELETE FROM sessions WHERE user_id = 'user_id';

-- Verify deletion
SELECT COUNT(*) FROM events WHERE ip_hash = 'hashed_ip';
```

### Data Export

```sql
-- Export user data
SELECT * FROM events WHERE site_id = 'site_id' 
INTO OUTFILE '/tmp/user_data.csv'
FIELDS TERMINATED BY ',';
```

### Data Retention

```env
# Default: 1 year
# Configure in ClickHouse
TTL timestamp + INTERVAL 1 YEAR

# Change to 30 days
ALTER TABLE events MODIFY TTL timestamp + INTERVAL 30 DAY;
```

## Audit Logging

### Enable Query Logging

```javascript
// Log all API access
app.addHook('onSend', async (request, reply, payload) => {
    app.log.info({
        method: request.method,
        url: request.url,
        status: reply.statusCode,
        ip: request.ip,
        userId: request.user?.id
    });
});
```

### Monitor Failed Access

```bash
# Check for failed authentication attempts
grep "Invalid credentials" /var/log/analytics/api.log | wc -l

# Alert if too many failures
# Configure with your monitoring tool
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Generate strong JWT_SECRET (32+ chars)
- [ ] Generate strong IP_HASH_SALT (32+ chars)
- [ ] Enable HTTPS/SSL
- [ ] Configure firewall rules
- [ ] Set CORS_ORIGINS correctly
- [ ] Enable database user accounts
- [ ] Database encryption at rest
- [ ] Regular backups with encryption
- [ ] Enable audit logging
- [ ] Implement rate limiting
- [ ] Input validation enabled
- [ ] Secrets not in version control
- [ ] Regular security updates
- [ ] Incident response plan
- [ ] Legal agreements in place

## Security Headers

Add to Nginx:

```nginx
# Prevent UI redressing attacks
add_header X-Frame-Options "SAMEORIGIN" always;

# Prevent content-type sniffing
add_header X-Content-Type-Options "nosniff" always;

# Enable XSS filter
add_header X-XSS-Protection "1; mode=block" always;

# Content Security Policy
add_header Content-Security-Policy "default-src 'self'" always;

# Referrer Policy
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# Enable HSTS
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

## Compliance

### PCI DSS
- Secure payment processing (if applicable)
- Regular security testing
- Documented security policies

### HIPAA
- For healthcare data:
  - Encryption at rest and in transit
  - Access controls
  - Audit trails
  - Business associate agreements

### SOC 2
- User access controls
- Data integrity
- Availability
- Confidentiality
- Privacy

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework/)

## Incident Response

### Detection

Monitor for:
- Unusual spike in failed login attempts
- High error rates
- Memory/CPU spikes
- Unauthorized API access

### Response

1. Isolate affected systems
2. Collect logs and evidence
3. Restore from clean backup
4. Verify integrity
5. Root cause analysis
6. Implement fixes
7. Document lessons learned

### Communication

- Notify affected users
- Prepare transparency report
- Update security measures
- Public communication if needed
