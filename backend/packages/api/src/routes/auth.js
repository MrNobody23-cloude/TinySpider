import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';

/* ─── Schemas ─────────────────────────────────────────────────── */

const registerSchema = {
    body: {
        type: 'object',
        additionalProperties: false,
        required: ['email', 'password'],
        properties: {
            email: { type: 'string', minLength: 3, maxLength: 255 },
            password: { type: 'string', minLength: 6, maxLength: 255 },
            full_name: { type: 'string', maxLength: 255 },
            company_name: { type: 'string', maxLength: 255 }
        }
    }
};

const loginSchema = {
    body: {
        type: 'object',
        additionalProperties: false,
        required: ['email', 'password'],
        properties: {
            email: { type: 'string', minLength: 3, maxLength: 255 },
            password: { type: 'string', minLength: 1, maxLength: 255 }
        }
    }
};

const forgotPasswordSchema = {
    body: {
        type: 'object',
        additionalProperties: false,
        required: ['email'],
        properties: {
            email: { type: 'string', minLength: 3, maxLength: 255 }
        }
    }
};

const resetPasswordSchema = {
    body: {
        type: 'object',
        additionalProperties: false,
        required: ['token', 'password'],
        properties: {
            token: { type: 'string', minLength: 1 },
            password: { type: 'string', minLength: 6, maxLength: 255 }
        }
    }
};

const updateProfileSchema = {
    body: {
        type: 'object',
        additionalProperties: false,
        properties: {
            full_name: { type: 'string', maxLength: 255 },
            company_name: { type: 'string', maxLength: 255 }
        }
    }
};

const changePasswordSchema = {
    body: {
        type: 'object',
        additionalProperties: false,
        required: ['current_password', 'new_password'],
        properties: {
            current_password: { type: 'string', minLength: 1 },
            new_password: { type: 'string', minLength: 6, maxLength: 255 }
        }
    }
};

/* ─── Helpers ─────────────────────────────────────────────────── */

const MAX_FAILED_LOGINS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function getSecret() {
    return process.env.JWT_SECRET || 'dev-secret';
}

function getExpiry() {
    return process.env.JWT_EXPIRY || '7d';
}

function signToken(payload) {
    return jwt.sign(payload, getSecret(), { expiresIn: getExpiry() });
}

function signRefreshToken(payload) {
    return jwt.sign(payload, getSecret(), { expiresIn: '30d' });
}

function hashPassword(password, testMode) {
    if (testMode) {
        return `test:${createHash('sha256').update(password).digest('hex')}`;
    }
    const rounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
    return bcrypt.hash(password, rounds);
}

function verifyPassword(password, passwordHash, testMode) {
    if (testMode) {
        return passwordHash === `test:${createHash('sha256').update(password).digest('hex')}`;
    }
    return bcrypt.compare(password, passwordHash);
}

function generateResetToken() {
    return randomBytes(32).toString('hex');
}

function sanitizeUser(row) {
    return {
        id: row.id,
        email: row.email,
        full_name: row.full_name || '',
        company_name: row.company_name || '',
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_login: row.last_login,
        is_active: row.is_active
    };
}

/* ─── Routes ──────────────────────────────────────────────────── */

export async function registerAuthRoutes(fastify) {

    /* ── Register ─────────────────────────────────────────────── */
    fastify.post('/api/auth/register', {
        schema: registerSchema,
        config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
    }, async (request, reply) => {
        let { email, password, full_name, company_name } = request.body;
        email = email.trim().toLowerCase();
        const passwordHash = await hashPassword(password, fastify.insight.testMode);

        try {
            const result = await fastify.insight.postgres.query(
                `INSERT INTO users (email, password_hash, full_name, company_name)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, email, full_name, company_name, created_at, updated_at, is_active`,
                [email, passwordHash, full_name || '', company_name || '']
            );

            const user = result.rows[0];
            const token = signToken({ sub: user.id, email: user.email });
            const refreshToken = signRefreshToken({ sub: user.id, email: user.email, type: 'refresh' });

            return reply.code(201).send({
                token,
                refreshToken,
                user: sanitizeUser(user)
            });
        } catch (err) {
            if (err.code === '23505') {
                return reply.code(409).send({ error: 'An account with this email already exists' });
            }
            fastify.log.warn({ err }, 'Failed to register user');
            return reply.code(400).send({ error: 'Registration failed' });
        }
    });

    /* ── Login ────────────────────────────────────────────────── */
    fastify.post('/api/auth/login', {
        schema: loginSchema,
        config: { rateLimit: { max: 20, timeWindow: '1 minute' } }
    }, async (request, reply) => {
        let { email, password } = request.body;
        email = email.trim().toLowerCase();

        const result = await fastify.insight.postgres.query(
            `SELECT id, email, password_hash, full_name, company_name, 
                    created_at, updated_at, is_active, last_login,
                    failed_login_count, locked_until
             FROM users WHERE email = $1 LIMIT 1`,
            [email]
        );

        const user = result.rows[0];
        if (!user) {
            return reply.code(401).send({ error: 'Invalid email or password' });
        }

        if (!user.is_active) {
            return reply.code(403).send({ error: 'Account is deactivated' });
        }

        // Check if account is locked
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
            return reply.code(429).send({
                error: `Account is locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`
            });
        }

        const ok = await verifyPassword(password, user.password_hash, fastify.insight.testMode);
        if (!ok) {
            // Increment failed login count
            const newCount = (user.failed_login_count || 0) + 1;
            const lockUntil = newCount >= MAX_FAILED_LOGINS
                ? new Date(Date.now() + LOCK_DURATION_MS).toISOString()
                : null;

            await fastify.insight.postgres.query(
                `UPDATE users SET failed_login_count = $1, locked_until = $2 WHERE id = $3`,
                [newCount, lockUntil, user.id]
            );

            if (newCount >= MAX_FAILED_LOGINS) {
                return reply.code(429).send({
                    error: 'Too many failed login attempts. Account locked for 15 minutes.'
                });
            }

            return reply.code(401).send({ error: 'Invalid email or password' });
        }

        // Reset failed login count on success, update last_login
        await fastify.insight.postgres.query(
            `UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login = now() WHERE id = $1`,
            [user.id]
        );

        const token = signToken({ sub: user.id, email: user.email });
        const refreshToken = signRefreshToken({ sub: user.id, email: user.email, type: 'refresh' });

        return reply.code(200).send({
            token,
            refreshToken,
            user: sanitizeUser(user)
        });
    });

    /* ── Refresh Token ────────────────────────────────────────── */
    fastify.post('/api/auth/refresh', async (request, reply) => {
        const { refreshToken } = request.body || {};
        if (!refreshToken) {
            return reply.code(400).send({ error: 'Refresh token is required' });
        }

        try {
            const payload = jwt.verify(refreshToken, getSecret());
            if (payload.type !== 'refresh') {
                return reply.code(401).send({ error: 'Invalid token type' });
            }

            const result = await fastify.insight.postgres.query(
                `SELECT id, email, is_active FROM users WHERE id = $1`,
                [payload.sub]
            );

            const user = result.rows[0];
            if (!user || !user.is_active) {
                return reply.code(401).send({ error: 'User not found or deactivated' });
            }

            const newToken = signToken({ sub: user.id, email: user.email });
            const newRefreshToken = signRefreshToken({ sub: user.id, email: user.email, type: 'refresh' });

            return reply.code(200).send({
                token: newToken,
                refreshToken: newRefreshToken
            });
        } catch {
            return reply.code(401).send({ error: 'Invalid or expired refresh token' });
        }
    });

    /* ── Logout ───────────────────────────────────────────────── */
    fastify.post('/api/auth/logout', async (request, reply) => {
        // With JWT, logout is primarily client-side (discard the tokens).
        // Server-side: we can optionally blacklist the token in Redis.
        const authHeader = request.headers.authorization || '';
        if (authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7).trim();
            try {
                const payload = jwt.verify(token, getSecret());
                const ttl = payload.exp - Math.floor(Date.now() / 1000);
                if (ttl > 0 && fastify.insight.redis) {
                    await fastify.insight.redis.setex(`blacklist:${token}`, ttl, '1');
                }
            } catch {
                // Token already expired or invalid, that's fine
            }
        }
        return reply.code(200).send({ message: 'Logged out successfully' });
    });

    /* ── Forgot Password ──────────────────────────────────────── */
    fastify.post('/api/auth/forgot-password', {
        schema: forgotPasswordSchema,
        config: { rateLimit: { max: 5, timeWindow: '1 minute' } }
    }, async (request, reply) => {
        const { email } = request.body;

        const result = await fastify.insight.postgres.query(
            `SELECT id, email FROM users WHERE email = $1 AND is_active = true LIMIT 1`,
            [email]
        );

        // Always respond success (don't leak whether email exists)
        if (!result.rows[0]) {
            return reply.code(200).send({ message: 'If that email exists, a reset link has been sent.' });
        }

        const resetToken = generateResetToken();
        const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await fastify.insight.postgres.query(
            `UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3`,
            [resetToken, expiry.toISOString(), result.rows[0].id]
        );

        // In production, send email with reset link here.
        // For development, log the token.
        fastify.log.info({ resetToken, email }, 'Password reset token generated');

        return reply.code(200).send({
            message: 'If that email exists, a reset link has been sent.',
            // Only include in dev mode for testing
            ...(process.env.NODE_ENV !== 'production' && { _dev_token: resetToken })
        });
    });

    /* ── Reset Password ───────────────────────────────────────── */
    fastify.post('/api/auth/reset-password', {
        schema: resetPasswordSchema,
        config: { rateLimit: { max: 5, timeWindow: '1 minute' } }
    }, async (request, reply) => {
        const { token, password } = request.body;

        const result = await fastify.insight.postgres.query(
            `SELECT id, email FROM users 
             WHERE reset_token = $1 AND reset_token_expiry > now() AND is_active = true 
             LIMIT 1`,
            [token]
        );

        const user = result.rows[0];
        if (!user) {
            return reply.code(400).send({ error: 'Invalid or expired reset token' });
        }

        const passwordHash = await hashPassword(password, fastify.insight.testMode);

        await fastify.insight.postgres.query(
            `UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL,
                              failed_login_count = 0, locked_until = NULL, updated_at = now()
             WHERE id = $2`,
            [passwordHash, user.id]
        );

        return reply.code(200).send({ message: 'Password has been reset successfully' });
    });

    /* ── Get Profile ──────────────────────────────────────────── */
    fastify.get('/api/auth/profile', async (request, reply) => {
        // This route is behind the auth middleware, so request.user is set
        const authHeader = request.headers.authorization || '';
        if (!authHeader.startsWith('Bearer ')) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }

        const token = authHeader.slice(7).trim();
        let payload;
        try {
            payload = jwt.verify(token, getSecret());
        } catch {
            return reply.code(401).send({ error: 'Unauthorized' });
        }

        const result = await fastify.insight.postgres.query(
            `SELECT id, email, full_name, company_name, created_at, updated_at, last_login, is_active
             FROM users WHERE id = $1`,
            [payload.sub]
        );

        const user = result.rows[0];
        if (!user) {
            return reply.code(404).send({ error: 'User not found' });
        }

        return reply.code(200).send({ user: sanitizeUser(user) });
    });

    /* ── Update Profile ───────────────────────────────────────── */
    fastify.put('/api/auth/profile', { schema: updateProfileSchema }, async (request, reply) => {
        const authHeader = request.headers.authorization || '';
        if (!authHeader.startsWith('Bearer ')) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }

        const token = authHeader.slice(7).trim();
        let payload;
        try {
            payload = jwt.verify(token, getSecret());
        } catch {
            return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { full_name, company_name } = request.body;
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (full_name !== undefined) {
            updates.push(`full_name = $${paramIndex++}`);
            values.push(full_name);
        }
        if (company_name !== undefined) {
            updates.push(`company_name = $${paramIndex++}`);
            values.push(company_name);
        }

        if (updates.length === 0) {
            return reply.code(400).send({ error: 'No fields to update' });
        }

        updates.push(`updated_at = now()`);
        values.push(payload.sub);

        const result = await fastify.insight.postgres.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
             RETURNING id, email, full_name, company_name, created_at, updated_at, last_login, is_active`,
            values
        );

        const user = result.rows[0];
        if (!user) {
            return reply.code(404).send({ error: 'User not found' });
        }

        return reply.code(200).send({ user: sanitizeUser(user) });
    });

    /* ── Change Password ──────────────────────────────────────── */
    fastify.post('/api/auth/change-password', { schema: changePasswordSchema }, async (request, reply) => {
        const authHeader = request.headers.authorization || '';
        if (!authHeader.startsWith('Bearer ')) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }

        const token = authHeader.slice(7).trim();
        let payload;
        try {
            payload = jwt.verify(token, getSecret());
        } catch {
            return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { current_password, new_password } = request.body;

        const result = await fastify.insight.postgres.query(
            `SELECT id, password_hash FROM users WHERE id = $1`,
            [payload.sub]
        );

        const user = result.rows[0];
        if (!user) {
            return reply.code(404).send({ error: 'User not found' });
        }

        const ok = await verifyPassword(current_password, user.password_hash, fastify.insight.testMode);
        if (!ok) {
            return reply.code(400).send({ error: 'Current password is incorrect' });
        }

        const newHash = await hashPassword(new_password, fastify.insight.testMode);
        await fastify.insight.postgres.query(
            `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`,
            [newHash, user.id]
        );

        return reply.code(200).send({ message: 'Password changed successfully' });
    });

    /* ── Delete Account ───────────────────────────────────────── */
    fastify.delete('/api/auth/account', async (request, reply) => {
        const authHeader = request.headers.authorization || '';
        if (!authHeader.startsWith('Bearer ')) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }

        const token = authHeader.slice(7).trim();
        let payload;
        try {
            payload = jwt.verify(token, getSecret());
        } catch {
            return reply.code(401).send({ error: 'Unauthorized' });
        }

        // Soft delete: deactivate the account
        await fastify.insight.postgres.query(
            `UPDATE users SET is_active = false, updated_at = now() WHERE id = $1`,
            [payload.sub]
        );

        return reply.code(200).send({ message: 'Account deactivated successfully' });
    });
}
