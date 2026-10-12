# Project Guide

Role-Based User Authentication & JWT Microservice

> Arrowstack Technologies — Internship Task 1

This document explains **what the project is**, **what every part of it does**, and
**how to run it** end to end.

---

## Table of contents

1. [What is this project?](#1-what-is-this-project)
2. [What it can do (features)](#2-what-it-can-do-features)
3. [Technology stack](#3-technology-stack)
4. [High-level architecture](#4-high-level-architecture)
5. [Project structure](#5-project-structure)
6. [Explanation of each part](#6-explanation-of-each-part)
7. [Data model](#7-data-model)
8. [API endpoints](#8-api-endpoints)
9. [How to run the project](#9-how-to-run-the-project)
10. [Running the tests](#10-running-the-tests)
11. [Environment variables reference](#11-environment-variables-reference)
12. [npm scripts reference](#12-npm-scripts-reference)
13. [Troubleshooting](#13-troubleshooting)
14. [Notes, decisions and limitations](#14-notes-decisions-and-limitations)

---

## 1. What is this project?

This is a **production-style authentication microservice** built with **Node.js +
Express**. It is the backend service responsible for everything related to user
identity:

- Creating user accounts (**registration**).
- Verifying credentials and issuing **JSON Web Tokens (JWT)** (**login**).
- Keeping sessions alive safely with **refresh tokens that rotate on every use**.
- Enforcing **roles** (`USER` and `ADMIN`) on protected endpoints.
- Letting users read and update **their own profile**.
- Letting administrators **manage all users** (list, view, enable/disable, change
  role, delete).
- Writing an **audit trail** of security-relevant events.
- Exposing **interactive API documentation** (Swagger / OpenAPI 3).
- Shipping with an **automated test suite**.

It is a standalone microservice: it exposes an HTTP/JSON API that a frontend or
another service can call. It does **not** include a UI.

The guiding design goals are **security first** (hashed passwords, token rotation,
role checks, rate limiting, no secret leakage) and **clean layering** (routes →
controllers → services → models) so that each file has a single responsibility.

---

## 2. What it can do (features)

| Area | Capabilities |
|------|--------------|
| Registration | Create a standard `USER`; validates email/password strength; rejects duplicate emails; admins cannot be self-registered. |
| Login | Email + password login; issues a short-lived **access token** and a long-lived **refresh token**; logs failed/disabled logins. |
| JWT access tokens | Signed (HS256), short lifetime, validated for signature, expiry, issuer and audience. |
| Refresh tokens | Stored only as SHA-256 hashes; **rotate on every use**; reuse of an old token revokes the entire token family. |
| Logout | Revokes one refresh token, or all of a user's refresh tokens when none is supplied. |
| Change password | Requires the current password; revokes all existing refresh tokens. |
| Profile | Read (`GET`) and update (`PATCH`) the authenticated user's own `name`/`email`. |
| Role-based access | `ADMIN`-only routes; role is always read from the database, never trusted from the client. |
| Admin user management | Paginated list + search, get by UUID, enable/disable, change role, delete. |
| Safeguards | An admin cannot disable/delete/demote **themselves**, and the **last active admin** cannot be removed or demoted. |
| Audit log | Records register, login success/failure, logout, password change, token reuse and all admin actions. |
| Security middleware | Helmet, CORS allow-list, per-route rate limiting, request IDs, centralized error handling, input validation. |
| Documentation | Swagger UI and a raw OpenAPI JSON document. |
| Testing | Jest + Supertest integration tests over the real HTTP API. |

---

## 3. Technology stack

| Area | Choice |
|------|--------|
| Runtime | Node.js >= 18 (native ES modules) |
| Framework | Express.js 4 |
| Database | **MySQL 8** (default, via `mysql2`); SQLite supported for tests/local fallback |
| ORM | Sequelize 6 |
| Migrations | Umzug 3 |
| Auth | `jsonwebtoken`, `bcryptjs` |
| Validation | `express-validator` |
| Security | `helmet`, `cors`, `express-rate-limit` |
| Docs | `swagger-jsdoc`, `swagger-ui-express` |
| Testing | `jest`, `supertest` |
| Tooling | `nodemon`, `eslint`, `dotenv` |

---

## 4. High-level architecture

The request travels down through clearly separated layers:

```
                     Client (frontend / Postman / another service)
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │            Express            │
                        │  helmet · cors · json · ids   │
                        └───────────────┬───────────────┘
                                        │
                    /api/v1/auth/*  /api/v1/users/*  /api/v1/admin/users/*
                                        │
                                        ▼
                    Routes → Validators → Controllers → Services → Models
                                        │
                    Middleware: authenticate · authorize · rate limit · errors
                                        │
                                        ▼
                             MySQL  (or SQLite in tests)
```

- **Routes** decide which URL maps to which controller and which middleware runs.
- **Validators** reject malformed input before any business logic runs.
- **Controllers** translate HTTP ↔ service calls and stay thin.
- **Services** hold the actual business rules (hashing, token rotation, RBAC
  safeguards) and are the most valuable code to unit-test.
- **Models** describe the tables and their relationships.
- **Middleware** handles cross-cutting concerns (auth, roles, throttling, errors,
  request IDs).

---

## 5. Project structure

```
auth-microservice/
├── src/
│   ├── config/          # Sequelize instance + environment parsing/validation
│   ├── models/          # Sequelize models (User, RefreshToken, AuditLog)
│   ├── migrations/      # Versioned, reversible schema changes (Umzug)
│   ├── controllers/     # HTTP <-> service translation
│   ├── services/        # Business logic
│   ├── middleware/      # auth, RBAC, validation, rate limiting, errors, IDs
│   ├── validators/      # express-validator chains
│   ├── routes/          # URL -> controller mapping + Swagger JSDoc
│   ├── utils/           # ApiError, asyncHandler, crypto, asyncLock, response
│   ├── docs/            # OpenAPI / Swagger definition
│   ├── app.js           # Builds the Express app (no network listen)
│   └── server.js        # Connects to DB and starts the server
├── tests/               # Jest + Supertest suites and helpers
│   └── helpers/         # env, DB lifecycle, factories, shared barrel
├── docs/                # Architecture document
├── scripts/             # db migrate, dev DB, test runner, admin seeding
├── .env.example         # Documented environment template
├── .gitignore
├── docker-compose.yml   # MySQL 8.4 for local development
├── eslint.config.js
├── jest.config.mjs
├── package.json
├── PROJECT_GUIDE.md     # This file
└── README.md
```

---

## 6. Explanation of each part

### `src/config/`
- **`environment.js`** — loads `.env` via `dotenv` and **validates** everything on
  startup: it refuses to boot if `JWT_ACCESS_SECRET` is missing or a placeholder,
  requires `DATABASE_URL` when the dialect is MySQL, rejects wildcard
  `CORS_ORIGIN` in production, and parses numeric settings. Exposes a single
  frozen `env` object used everywhere.
- **`database.js`** — builds the single **Sequelize** instance. It uses **MySQL**
  by default and can switch to **SQLite** when `DB_DIALECT=sqlite`. Also exports
  `testConnection()`.

### `src/models/`  (data layer)
- **`User.js`** — the `users` table: UUID id, name, unique lowercased email,
  `passwordHash`, `role` (`USER`/`ADMIN`), `isActive`.
- **`RefreshToken.js`** — the `refresh_tokens` table: hash of the token (never the
  raw value), expiry, revocation timestamp, and which token replaced it.
- **`AuditLog.js`** — the `audit_logs` table: who did what (`action`), to whom
  (`targetUserId`), with a request id and flexible JSON `details`.
- **`index.js`** — defines the associations between models.

### `src/migrations/`
Versioned, **reversible** schema changes run by **Umzug**. Creating the schema is
explicit (`npm run db:migrate`), never automatic at boot. Three migrations create
`users`, `refresh_tokens` and `audit_logs` (with indexes and foreign keys).

### `src/controllers/`
Thin HTTP adapters. They read the request, call a service, and shape the response.
No business logic lives here.
- **`authController.js`** — register, login, refresh, logout, change password.
- **`userController.js`** — get/update own profile.
- **`adminController.js`** — admin user-management actions.

### `src/services/`  (business logic)
- **`authService.js`** — registration, login, **refresh-token rotation**, logout
  and password change. Rotation is transactional; MySQL uses a row lock, and
  SQLite uses an in-process lock (see `asyncLock`).
- **`tokenService.js`** — signs/verifies access tokens and issues refresh tokens.
- **`userService.js`** — profile access, admin listing/search, status, role and
  delete operations, plus the **self-operation** and **last-admin** safeguards.
- **`auditService.js`** — writes audit rows best-effort (never breaks the main
  request) and centralizes the list of recorded actions.

### `src/middleware/`
- **`authenticate.js`** — extracts the `Bearer` token, verifies it, loads the user
  and rejects missing/invalid/expired tokens.
- **`authorize.js`** — role gate factory, e.g. `authorize('ADMIN')`.
- **`validateRequest.js`** — runs `express-validator` chains and returns `400` on
  failure.
- **`rateLimiter.js`** — login, refresh and global API limiters.
- **`requestId.js`** — assigns/propagates an `X-Request-Id` for tracing.
- **`errorHandler.js`** — consistent JSON error shape plus a `404` handler, and
  hides internals in production.

### `src/validators/`
Declarative **`express-validator`** chains describing required fields, formats
(email, UUID), lengths and allowed values.
- **`authValidators.js`** — register, login, refresh, logout, change-password.
- **`userValidators.js`** — profile update, admin list/pagination, UUID params,
  status, role.

### `src/routes/`
Map URLs to controllers, attach middleware, and carry the **Swagger JSDoc** that
generates the OpenAPI document.
- **`authRoutes.js`** → `/api/v1/auth/*`
- **`userRoutes.js`** → `/api/v1/users/*`
- **`adminRoutes.js`** → `/api/v1/admin/users/*`
- **`index.js`** → mounts all three under `/api/v1`.

### `src/utils/`
- **`ApiError.js`** — typed operational errors with HTTP status and a stable error
  `code`; helpers like `unauthorized`, `conflict`, `tooManyRequests`.
- **`asyncHandler.js`** — wraps async route handlers so rejected promises reach the
  error handler.
- **`crypto.js`** — refresh-token generation and **SHA-256 hashing**.
- **`asyncLock.js`** — a tiny keyed in-process lock used to serialize refresh
  rotation under SQLite (MySQL uses real row locks instead).
- **`response.js`** — helpers for the consistent success envelope.

### `src/docs/swagger.js`
The **OpenAPI 3.0** definition (title, servers, security scheme, tags). Route-level
JSDoc is collected into the final spec served at `/api-docs`.

### `src/app.js` and `src/server.js`
- **`app.js`** builds the Express application (security middleware, `/health`,
  Swagger UI, `/api/v1` routes, 404 and error handlers) **without** listening — so
  tests can import it directly.
- **`server.js`** verifies the DB connection, starts listening, prints useful URLs
  and handles graceful shutdown on `SIGINT`/`SIGTERM`.

### `tests/`
- **`auth.test.js`** — registration, login, JWT validation, refresh rotation
  (including a concurrent-refresh case), logout, change password.
- **`user.test.js`** — profile get/update, protected fields, duplicate email.
- **`admin.test.js`** — listing/pagination/search, get by UUID, status, role,
  delete, self-operation and last-admin safeguards.
- **`security.test.js`** — Helmet headers, CORS, request IDs, malformed JSON, 404
  contract, rate limiting, no secret leakage, Swagger availability.
- **`tests/helpers/`** — environment setup, DB lifecycle (migrate/reset/close),
  data factories, and a shared import barrel.

### `scripts/`
- **`db.mjs`** — `up` / `down` / `status` migrations.
- **`dev-db.mjs`** — start/stop/status/reset the Docker MySQL container and wait
  until it is ready.
- **`seed-admin.mjs`** — runs migrations then idempotently creates (or promotes) the
  first administrator. Prints no secrets.
- **`run-tests.mjs`** — Jest runner with the ESM flags the project needs.

### Root files
- **`.env.example`** — fully documented template for your private `.env`.
- **`docker-compose.yml`** — MySQL 8.4 with a healthcheck and a persistent volume.
- **`jest.config.mjs`** — Node test environment, single worker, coverage config.
- **`eslint.config.js`** — flat ESLint config.
- **`package.json`** — dependencies and the npm scripts listed below.

---

## 7. Data model

**`users`**

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | v4 |
| name | string(120) | required |
| email | string(255) | required, **unique**, stored lowercase |
| passwordHash | string(255) | bcrypt hash |
| role | ENUM | `USER` \| `ADMIN` |
| isActive | boolean | default `true` |
| createdAt / updatedAt | datetime | managed by Sequelize |

**`refresh_tokens`**

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| userId | UUID (FK → users.id) | owner |
| tokenHash | string(64) | SHA-256 of the raw token, **unique** |
| expiresAt | datetime | |
| revokedAt | datetime, nullable | set on rotation/logout |
| replacedByTokenId | UUID, nullable | rotation chain |
| createdAt | datetime | |

**`audit_logs`**

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| userId | UUID, nullable | actor (null when unknown) |
| action | string(120) | e.g. `LOGIN_SUCCESS` |
| targetUserId | UUID, nullable | affected user |
| requestId | string(64), nullable | correlates with `X-Request-Id` |
| details | JSON, nullable | extra context |
| createdAt | datetime | |

---

## 8. API endpoints

Base URL: `http://localhost:3000`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Liveness/uptime probe |
| GET | `/api-docs` | — | Swagger UI |
| GET | `/api-docs.json` | — | Raw OpenAPI document |
| POST | `/api/v1/auth/register` | — | Register a `USER` |
| POST | `/api/v1/auth/login` | — (rate-limited) | Obtain access + refresh tokens |
| POST | `/api/v1/auth/refresh` | — (rate-limited) | Rotate refresh token → new token pair |
| POST | `/api/v1/auth/logout` | Bearer | Revoke one or all refresh tokens |
| POST | `/api/v1/auth/change-password` | Bearer | Change password; revokes sessions |
| GET | `/api/v1/users/me` | Bearer | Get own profile |
| PATCH | `/api/v1/users/me` | Bearer | Update own name/email |
| GET | `/api/v1/admin/users` | Bearer + `ADMIN` | List users (page, limit, search) |
| GET | `/api/v1/admin/users/{id}` | Bearer + `ADMIN` | Get one user by UUID |
| PATCH | `/api/v1/admin/users/{id}/status` | Bearer + `ADMIN` | Enable/disable a user |
| PATCH | `/api/v1/admin/users/{id}/role` | Bearer + `ADMIN` | Change role (`USER`/`ADMIN`) |
| DELETE | `/api/v1/admin/users/{id}` | Bearer + `ADMIN` | Delete a user |

**Status codes:** `200` OK, `201` Created, `400` validation/bad request, `401`
unauthenticated, `403` forbidden/disabled, `404` not found, `409` conflict
(duplicate email), `429` rate limited, `500` unexpected error.

Successful responses use an envelope such as
`{ "success": true, "message": "Success", "data": { ... } }`. Errors use
`{ "success": false, "message": "...", "error": { "code": "..." }, "requestId": "..." }`
(the `requestId` is present when a request id is available).

---

## 9. How to run the project

### Prerequisites

- **Node.js >= 18** and **npm** (ES modules are used).
- One of:
  - **Docker Desktop** (easiest — the bundled compose file starts MySQL 8.4), or
  - a **local MySQL 8** server.
- *No database server is required* if you only want to run tests, or if you set
  `DB_DIALECT=sqlite` for local use.

### Step 1 — Install dependencies

```bash
# from the project root
npm install
```

### Step 2 — Create your environment file

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# Linux / macOS
cp .env.example .env
```

Then generate a strong JWT secret and paste it into `.env` as
`JWT_ACCESS_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Step 3 — Start the database

**Option A — Docker MySQL (recommended for full MySQL parity)**

```bash
npm run dev:db          # starts MySQL, waits until it is ready
```

Other helpers (invoke the script directly):

```bash
node scripts/dev-db.mjs status   # show container status
node scripts/dev-db.mjs down     # stop the container
node scripts/dev-db.mjs reset    # wipe the volume and start fresh (DELETES data)
```

**Option B — Local MySQL server**

Create the database, then point `.env` at it:

```env
DB_DIALECT=mysql
DATABASE_URL=mysql://root:your_password@127.0.0.1:3306/auth_microservice_db
```

**Option C — SQLite (no server, for quick local runs)**

```env
DB_DIALECT=sqlite
DB_STORAGE=./.tmp/auth.sqlite
```

> MySQL remains the intended production database. SQLite exists only so the app
> and tests can run on a machine without a MySQL server.

### Step 4 — Run migrations

```bash
npm run db:migrate          # apply all pending migrations
npm run db:migrate:status   # list executed vs pending
npm run db:migrate:undo     # revert the most recent migration
```

### Step 5 — Create the first administrator

There is intentionally **no endpoint** to create admins. Use the seed script:

```bash
# Windows (PowerShell)
$env:ADMIN_NAME="Administrator"
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="ChangeMe_Before_Using_In_Prod_12345!"
npm run db:seed:admin

# Linux / macOS
ADMIN_NAME="Administrator" \
ADMIN_EMAIL="admin@example.com" \
ADMIN_PASSWORD="ChangeMe_Before_Using_In_Prod_12345!" \
npm run db:seed:admin
```

### Step 6 — Start the application

```bash
npm run dev    # development (auto-restarts on file changes)
npm start      # production-style start
```

On success you will see:

```
Auth microservice running in development mode
  - API base:   http://localhost:3000/api/v1
  - Swagger UI: http://localhost:3000/api-docs
  - Health:     http://localhost:3000/health
```

### Step 7 — Explore and smoke-test

- Open **Swagger UI**: `http://localhost:3000/api-docs`
- Check **health**: `http://localhost:3000/health`
- Register a user and log in:

```bash
# Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Vishnu\",\"email\":\"vishnu@example.com\",\"password\":\"StrongPassword123!\"}"

# Login (returns accessToken + refreshToken)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"vishnu@example.com\",\"password\":\"StrongPassword123!\"}"
```

Use the returned `accessToken` as a `Bearer` token on protected endpoints:

```bash
curl http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer <accessToken>"
```

---

## 10. Running the tests

By default the suite runs against a **throwaway SQLite database**, so **no
database server is required**:

```bash
npm test               # all suites
npm run test:coverage  # with coverage report
```

To run the same suite against **MySQL** instead:

```bash
# Windows (PowerShell)
$env:TEST_DB_DIALECT="mysql"; npm test

# Linux / macOS
TEST_DB_DIALECT=mysql npm test
```

In MySQL mode the tests create and use an isolated `auth_microservice_test_db`;
your development data is never touched.

The suite covers registration, login, JWT validation, refresh rotation (including
concurrency), logout, password change, profile management, admin management and
security controls. Current status: **all suites passing**.

---

## 11. Environment variables reference

| Variable | Purpose | Example / default |
|----------|---------|-------------------|
| `PORT` | HTTP port | `3000` |
| `NODE_ENV` | `development` / `test` / `production` | `development` |
| `DB_DIALECT` | `mysql` (default) or `sqlite` | `mysql` |
| `DATABASE_URL` | MySQL connection string (required for MySQL) | `mysql://root:postgres@127.0.0.1:3306/auth_microservice_db` |
| `DB_STORAGE` | SQLite file path (only for SQLite) | `./.tmp/auth.sqlite` |
| `MYSQL_ROOT_PASSWORD` | Password for the Docker MySQL container | `postgres` |
| `MYSQL_DATABASE` | Database created by the container | `auth_microservice_db` |
| `JWT_ACCESS_SECRET` | **Strong** signing secret (>= 32 chars in prod) | random hex |
| `JWT_ACCESS_EXPIRES_IN` | Access-token lifetime | `15m` |
| `JWT_ISSUER` | JWT issuer claim | `auth-microservice` |
| `JWT_AUDIENCE` | JWT audience claim | `auth-api` |
| `REFRESH_TOKEN_TTL_DAYS` | Refresh-token lifetime | `7` |
| `BCRYPT_SALT_ROUNDS` | bcrypt cost factor | `12` |
| `CORS_ORIGIN` | Comma-separated allowed origins | `http://localhost:5173` |
| `LOGIN_RATE_LIMIT_MAX` / `_WINDOW_MS` | Login throttle | `10` / `900000` |
| `REFRESH_RATE_LIMIT_MAX` / `_WINDOW_MS` | Refresh throttle | `60` / `900000` |
| `API_RATE_LIMIT_MAX` / `_WINDOW_MS` | Global API throttle | `300` / `900000` |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Used only by `db:seed:admin` | — |
| `TEST_DB_DIALECT` | Test dialect: `sqlite` (default) or `mysql` | `sqlite` |
| `TEST_DB_STORAGE` | Optional explicit SQLite file for tests | temp file |

---

## 12. npm scripts reference

| Script | What it does |
|--------|--------------|
| `npm run dev` | Start with nodemon (auto-restart) |
| `npm start` | Start normally |
| `npm test` | Run the Jest suite (SQLite by default) |
| `npm run test:coverage` | Tests + coverage report |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:migrate:undo` | Revert the last migration |
| `npm run db:migrate:status` | Show executed vs pending migrations |
| `npm run db:seed:admin` | Create/promote the first admin |
| `npm run dev:db` | Start the Docker MySQL container |
| `npm run lint` | Run ESLint |

---

## 13. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Missing required environment variable: DATABASE_URL (required for the MySQL dialect)` | No `.env`, or `DB_DIALECT=mysql` without a URL | Copy `.env.example` to `.env`, or use `DB_DIALECT=sqlite` |
| `JWT_ACCESS_SECRET is set to an insecure placeholder` | Default secret left in place | Generate a random 64-byte hex secret |
| `ECONNREFUSED` / `connect ETIMEDOUT` on startup | MySQL not running | `npm run dev:db`, or start MySQL |
| `Access denied for user 'root'` | Password mismatch | Make `MYSQL_ROOT_PASSWORD` match the password in `DATABASE_URL` |
| `Table 'auth_microservice_db.users' doesn't exist` | Migrations not run | `npm run db:migrate` |
| Tests can't connect (MySQL mode) | `TEST_DB_DIALECT=mysql` but no server | Start MySQL, or unset it to use SQLite |
| `429 Too Many Requests` on login | Rate limit hit | Wait for the window or raise `LOGIN_RATE_LIMIT_MAX` |
| Everything returns 500 after changing `.env` | Stale server process | Restart with `npm run dev` |

---

## 14. Notes, decisions and limitations

- **Database choice.** The original task specification asked for **PostgreSQL**.
  The existing project was already built on **MySQL**, so to avoid silently
  replacing an established architecture, **MySQL was kept**. Everything else in
  the specification (schema, indexes, foreign keys, migrations, security) is
  implemented. Migrating to PostgreSQL later is a small change: swap `mysql2` for
  `pg`, set `dialect: 'postgres'`, and change `DataTypes.JSON` to `JSONB`.
- **Access-token revocation.** Access tokens stay valid until they expire even
  after logout or a password change; only refresh tokens are revoked immediately.
  This is a standard trade-off for stateless JWTs with short lifetimes.
- **Refresh-token rotation.** Tokens are single-use. Presenting an already-used
  token revokes the whole family, which limits damage from a stolen token.
- **SQLite fallback.** Intended for tests and quick local runs only; MySQL is the
  production target.
- **No UI.** This is an API-only microservice. Use Swagger UI, Postman or curl.

---

*See `README.md` for a shorter quick-start and `docs/architecture.md` for a deeper
architecture discussion.*
