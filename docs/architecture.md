# Architecture — Role-Based Authentication & JWT Microservice

## 1. Purpose

This service is a standalone **authentication and authorization microservice**.
It owns user identities, credentials, sessions (refresh tokens), and roles. Other
applications can delegate login/signup/profile duties to it and verify the JWTs it
issues.

## 2. High-level architecture

```
                 ┌────────────────────────────────────────────────┐
   HTTP client   │                  Express app                    │
  (browser/API)  │                                                  │
      │          │  Helmet → CORS → JSON body → requestId           │
      └────────► │        │                                          │
                 │        ▼                                          │
                 │  /api/v1 router ──► rate limiter (global)         │
                 │        │                                          │
                 │        ├── /auth      (register/login/refresh/…)  │
                 │        ├── /users     (profile, auth required)    │
                 │        └── /admin/users (ADMIN role required)     │
                 │        │                                          │
                 │        ▼                                          │
                 │  controllers → services → models (Sequelize)      │
                 │        │                    │                     │
                 │        │                    ▼                     │
                 │        │             MySQL database               │                 │        ▼                                          │
                 │  middleware: authenticate / authorize /           │
                 │              validateRequest / errorHandler       │
                 └────────────────────────────────────────────────┘
```

> The Sequelize instance targets **MySQL** by default. Setting `DB_DIALECT=sqlite`
> points it at an embedded SQLite file instead; the test suite uses this so it can
> run without a database server. MySQL remains the production target.

### Layers

| Layer | Folder | Responsibility |
|-------|--------|----------------|
| Routes | `src/routes` | Map URLs to controllers + attach validators/middleware. Also hold Swagger JSDoc. |
| Controllers | `src/controllers` | Translate HTTP ↔ service calls; never contain business logic. |
| Services | `src/services` | Business logic: auth, tokens, users, audit. |
| Models | `src/models` | Sequelize models and associations. |
| Migrations | `src/migrations` | Versioned, reversible schema changes (Umzug). |
| Middleware | `src/middleware` | Auth, RBAC, validation, rate limiting, error handling, request IDs. |
| Validators | `src/validators` | `express-validator` chains (input validation). |
| Config | `src/config` | Environment parsing/validation and the Sequelize instance. |
| Utils | `src/utils` | `ApiError`, `asyncHandler`, crypto helpers, `asyncLock`, response helpers. |

**Why this separation?** It keeps each file small and testable. Controllers stay
thin, services hold the rules, and middleware is reusable across routes.

## 3. Data model

```
users                           refresh_tokens                 audit_logs
─────────────────────           ─────────────────────          ─────────────────────
id            UUID (PK)         id            UUID (PK)        id            UUID (PK)
name          VARCHAR(120)      userId        UUID (FK→users)  userId        UUID (FK→users, NULL)
email         VARCHAR(255) UK   tokenHash     CHAR(64) UK      action        VARCHAR(120)
passwordHash  VARCHAR(255)      expiresAt     DATETIME         targetUserId  UUID (FK→users, NULL)
role          ENUM(USER,ADMIN)  revokedAt     DATETIME NULL    requestId     VARCHAR(64) NULL
isActive      BOOLEAN           replacedBy    UUID NULL        details       JSON NULL
createdAt     DATETIME          createdAt     DATETIME         createdAt     DATETIME
updatedAt     DATETIME
```

Relationships:

- `users 1—* refresh_tokens` — `ON DELETE CASCADE` (deleting a user removes sessions).
- `users 1—* audit_logs` (as actor) — `ON DELETE SET NULL` (keep the trail, drop the link).
- `audit_logs.targetUserId` optionally points at the affected user.

### Why store refresh-token *hashes*?

Refresh tokens are long-lived secrets. If the database leaks, raw tokens would let
an attacker mint new access tokens indefinitely. We store only `SHA-256(token)`,
so a stolen database row cannot be replayed.

## 4. Authentication & token strategy

### Access tokens

- Signed with `HS256` using `JWT_ACCESS_SECRET`.
- Short-lived (`JWT_ACCESS_EXPIRES_IN`, default `15m`).
- Claims: `sub` (user id), `role`, plus standard `iss`, `aud`, `iat`, `exp`.
- Verified for **signature, expiration, issuer and audience** on every request.
- The role in the token is *not trusted* for authorization: `authenticate`
  re-reads the user from the database and uses the current DB role.

### Refresh tokens

- 64 random bytes → 128 hex characters (`crypto.randomBytes`).
- Only the SHA-256 hash is persisted.
- **Rotation**: every successful `/auth/refresh` revokes the old row and issues a
  new one, recording `replacedByTokenId`.
- **Reuse detection**: presenting an already-revoked token revokes *all* of that
  user's active refresh tokens (the whole "token family"), forcing re-login.
- Wrapped in a DB transaction with `SELECT … FOR UPDATE` so concurrent refreshes
  cannot both succeed.

### Logout & password change

- Logout revokes the supplied refresh token, or all of the user's tokens when none
  is supplied.
- Password change re-hashes with bcrypt and revokes **all** existing refresh tokens.
- Note: access tokens remain valid until they expire. This is a deliberate,
  documented trade-off; a denylist or token-version column would be needed to
  revoke access tokens immediately.

## 5. Authorization (RBAC)

Two roles: `USER` and `ADMIN`.

- `authenticate` proves identity and attaches `{ id, role }`.
- `authorize('ADMIN')` checks the role from the database.

Admin endpoints are mounted under `/api/v1/admin/users` and apply
`authenticate, authorize('ADMIN')` to every route.

Safeguards:

- Public registration can never assign `ADMIN`.
- Admins cannot change their own role/status or delete themselves.
- The last active administrator cannot be disabled, demoted, or deleted.
- UUID path params are validated before hitting the database.

## 6. Security controls

| Control | Where |
|--------|-------|
| Password hashing (bcrypt, cost 12) | `authService.registerUser`, `changePassword` |
| Short-lived access tokens | `tokenService.signAccessToken` |
| Refresh rotation + reuse detection | `authService.refreshTokens` |
| Rate limiting (login/refresh/global) | `middleware/rateLimiter.js` |
| Input validation | `validators/*`, `middleware/validateRequest.js` |
| Helmet security headers | `app.js` |
| Restrictive CORS | `app.js`, `config/environment.js` |
| Parameterized queries | Sequelize models (no string SQL) |
| Safe production errors | `middleware/errorHandler.js` |
| Env validation at startup | `config/environment.js` |
| Mass-assignment protection | services whitelist fields |
| Audit logging | `services/auditService.js` |
| Transactions for critical ops | `refreshTokens` |
| Request tracing | `middleware/requestId.js` |

**Never logged:** passwords, password hashes, access/refresh tokens, JWT secrets,
database passwords. Audit `details` only ever contain non-sensitive metadata.

## 7. Error & response contract

Success:

```json
{ "success": true, "message": "Profile retrieved successfully", "data": { } }
```

Error:

```json
{
  "success": false,
  "message": "Authentication required",
  "error": { "code": "AUTH_REQUIRED" },
  "requestId": "…"
}
```

Stack traces and SQL details are only exposed when `NODE_ENV !== production`.

## 8. Administrator bootstrap

There is **no public admin-creation endpoint**. The first admin is created with a
one-off CLI script:

```bash
npm run db:seed:admin
```

It reads `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` from the environment, runs
pending migrations, and idempotently creates/promotes the admin. Credentials are
never committed to Git.

## 9. Testing strategy

- Jest + Supertest exercise the HTTP API end to end.
- A dedicated test database (`auth_microservice_test_db`) is created and migrated
  automatically; tables are truncated between tests.
- Tests run with `--runInBand` to keep database state deterministic.
- Rate-limit stores are reset between tests.
