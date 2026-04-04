# TinySpider Authentication System

## Overview
TinySpider implements a secure, robust authentication system utilizing JSON Web Tokens (JWT) and PostgreSQL for persistent user storage. The frontend leverages Zustand for global state management and React Router for protected view isolation.

## Security Overview
1. **Password Hashing**: Passwords are never stored in plain text. They are hashed securely using `bcrypt` using 10 salt rounds by default.
2. **Access & Refresh Tokens**:
   - Short-lived Access Tokens (`7d` by default).
   - Long-lived Refresh Tokens (`30d`) to allow silent token refreshing without user intervention.
   - Frontend stores them in the browser's `localStorage` and utilizes Axios request/response interceptors to attach/renew them automatically.
3. **Rate Limiting**: Prevent brute-force attacks via `@fastify/rate-limit`.
4. **Account Lockouts**: Accounts are locked for 15 minutes after 5 consecutive failed login attempts.
5. **Reset Tokens**: Password reset links utilize a highly secure `crypto` randomly-generated string with a strict 1-hour expiration timescale.

## API Endpoints

### `POST /api/auth/register`
Creates a new user profile.
- **Request Body**:
  ```json
  {
    "email": "user@company.com",
    "password": "strongPassword123!",
    "full_name": "Jane Doe",
    "company_name": "Acme Corp"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "token": "eyJhbG...",
    "refreshToken": "eyJhbG...",
    "user": { "id": "...", "email": "...", ... }
  }
  ```

### `POST /api/auth/login`
Validates credentials to issue new tokens.
- **Request Body**:
  ```json
  {
    "email": "user@company.com",
    "password": "strongPassword123!"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "token": "eyJhbG...",
    "refreshToken": "eyJhbG...",
    "user": { ... }
  }
  ```

### `POST /api/auth/refresh`
Exchanges a valid refresh token for a new set of access & refresh tokens.
- **Request Body**:
  ```json
  { "refreshToken": "eyJhbG..." }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "token": "eyJhbG...",
    "refreshToken": "eyJhbG..."
  }
  ```

### `POST /api/auth/logout`
Revokes the active session on the backend.
- **Headers**: `Authorization: Bearer <token>`
- **Response** (`200 OK`)

### `GET /api/auth/profile`
Retrieves information for the currently active user profile.
- **Headers**: `Authorization: Bearer <token>`
- **Response** (`200 OK`):
  ```json
  { "user": { ... } }
  ```

### `PUT /api/auth/profile`
Updates the name and company for the current user.
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "full_name": "Jane Smith",
    "company_name": "Acme International"
  }
  ```

### `POST /api/auth/change-password`
Changes the active user's password.
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "current_password": "strongPassword123!",
    "new_password": "evenStrongerPassword456@"
  }
  ```

### `DELETE /api/auth/account`
Soft deletes (deactivates) the user account.
- **Headers**: `Authorization: Bearer <token>`

### `POST /api/auth/forgot-password`
Generates a reset link internally.
- **Request Body**:
  ```json
  { "email": "user@company.com" }
  ```

### `POST /api/auth/reset-password`
Verifies a token and overrides the previous password.
- **Request Body**:
  ```json
  {
    "token": "a1b2c3d4...",
    "password": "newSecurePassword1!"
  }
  ```

## Integration Guide

To protect your API route data locally or in newly created routes:

1. Import `registerAuthMiddleware` early on inside `app.js` or attach the Fastify prehandler.
2. If utilizing the Fastify hook, ensure your base route follows the path requirements starting with `/api/` but circumventing `/api/auth/`.

## Troubleshooting Common Issues

**Symptom: My token is expiring too quickly.**
- Change `JWT_EXPIRY` inside the `backend/.env` file. Options: `1h`, `7d`, `30d`.

**Symptom: CORS error on frontend when trying to login.**
- Be certain the `FRONTEND_URL` environment variable properly outlines your host (e.g. `http://localhost:5173` without trailing slash).

**Symptom: Cannot read properties of undefined (reading 'error') when logging in.**
- Validate your database `users` table layout has fully migrated to accept `locked_until` and `failed_login_count`. Run `node src/db/migrate.js`.
