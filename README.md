# Role-Based User Authentication & JWT Microservice

A production-style authentication microservice built with **Node.js, Express and
Sequelize**. It provides user registration, login, JWT access tokens,
refresh-token rotation, role-based access control (USER / ADMIN), profile
management and administrative user management.

> **Internship:** Arrowstack Technologies — Full Stack Development Internship,
> Task 1.

---

## Table of contents

1. [Project overview](#1-project-overview)
2. [Features](#2-features)
3. [Technology stack](#3-technology-stack)
4. [Architecture explanation](#4-architecture-explanation)
5. [Folder structure](#5-folder-structure)
6. [Prerequisites](#6-prerequisites)
7. [Installation](#7-installation)
8. [Database setup (MySQL)](#8-database-setup-mysql)
9. [Environment variables](#9-environment-variables)
10. [Database migrations](#10-database-migrations)
11. [Administrator bootstrap](#11-administrator-bootstrap)
12. [Starting the application](#12-starting-the-application)
13. [API endpoints](#13-api-endpoints)
14. [JWT authentication explained](#14-jwt-authentication-explained)
15. [Role-based authorization explained](#15-role-based-authorization-explained)
16. [Swagger documentation](#16-swagger-documentation)
17. [Automated testing](#17-automated-testing)
18. [Postman testing examples](#18-postman-testing-examples)
19. [Common errors and solutions](#19-common-errors-and-solutions)
20. [Security considerations](#20-security-considerations)
21. [Publishing to GitHub](#21-publishing-to-github)
22. [Limitations and future improvements](#22-limitations-and-future-improvements)

---

## 1. Project overview

This microservice is the **single source of truth for user identity** in a larger
system. Instead of every application storing passwords, they call this service to
register users and log them in, receive a signed JWT, and then send that JWT on
later requests.

The project demonstrates the security patterns expected in real systems:

- Passwords are hashed with **bcrypt** and never stored or returned in plain text.
- **Access tokens** are short-lived; **refresh tokens** are long-lived but stored
  only as hashes and **rotate on every use**.
- Authorization is **role-based** and always read from the database — a client
  can never grant itself a role.
- Sensitive administrative actions are written to an **audit log**.

---

## 2. Features

- ✅ User registration with validation and duplicate-email protection
- ✅ Login with bcrypt password verification and generic error messages
- ✅ Short-lived JWT **access tokens** (HS256, issuer + audience checked)
- ✅ High-entropy **refresh tokens** with **rotation** and **reuse detection**
- ✅ Logout (revoke one token or all sessions)
- ✅ Change password (revokes all existing sessions)
- ✅ Profile: `GET /users/me`, `PATCH /users/me` (name + email only)
- ✅ Role-based access control: `USER` and `ADMIN`
- ✅ Admin user management: list (paginated + search), get, enable/disable,
  change role, delete
- ✅ Last-administrator and self-operation safeguards
- ✅ Audit logging for security-sensitive actions
- ✅ Input validation (`express-validator`) with consistent error responses
- ✅ Security middleware: Helmet, restrictive CORS, rate limiting
- ✅ Request IDs for tracing
- ✅ Centralised error handling with safe production messages
- ✅ Swagger / OpenAPI documentation
- ✅ Automated tests with Jest + Supertest
- ✅ Database migrations (Umzug) with up/down support

---

## 3. Technology stack

| Area | Choice |
|------|--------|
| Runtime | Node.js (>= 18, ES modules) |
| Framework | Express.js 4 |
| Database | **MySQL 8** (via `mysql2`); **SQLite** supported for tests/local fallback |
| ORM | Sequelize 6 |
| Migrations | Umzug 3 |
| Auth | `jsonwebtoken`, `bcryptjs` |
| Validation | `express-validator` |
| Security | `helmet`, `cors`, `express-rate-limit` |
| Docs | `swagger-jsdoc`, `swagger-ui-express` |
| Testing | `jest`, `supertest` |
| Dev | `nodemon`, `eslint`, `dotenv` |

> **Database note.** The original task specification asked for **PostgreSQL**.
> The existing project in this folder was already built on **MySQL**, so — per
> the instruction not to silently replace an established architecture — MySQL was
> kept. Everything else in the specification (schema, indexes, foreign keys,
> migrations, security) is implemented. See
> [Limitations](#22-limitations-and-future-improvements) for the PostgreSQL
> migration path. Swapping to PostgreSQL is a small change: replace `mysql2` with
> `pg`, set `dialect: 'postgres'`, and change `DataTypes.JSON` to `JSONB`.

---

## 4. Architecture explanation

The code is split into clear layers so each file has one job:

```
Request → Routes → Validators → Controllers → Services → Models → MySQL (or SQLite)
                              ↘ Middleware (auth, RBAC, rate limit, errors)
```

- **Routes** decide *which* URL calls *which* controller and which middleware runs.
- **Validators** reject bad input before it reaches business logic.
- **Controllers** translate HTTP ↔ service calls and stay thin.
- **Services** contain the actual business rules (hashing, token rotation, RBAC
  safeguards). This is the code you would unit-test most.
- **Models** describe the data and its relationships.
- **Middleware** handles cross-cutting concerns (authentication, authorization,
  rate limiting, errors, request IDs).

A fuller explanation, including the data model and security controls, lives in
[`docs/architecture.md`](docs/architecture.md).

---

## 5. Folder structure

```
auth-microservice/
├── src/
│   ├── config/
│   │   ├── database.js            # Sequelize instance (MySQL or SQLite)
│   │   └── environment.js         # Loads + validates env vars
│   ├── models/
│   │   ├── User.js
│   │   ├── RefreshToken.js
│   │   ├── AuditLog.js
│   │   └── index.js               # Associations
│   ├── migrations/
│   │   ├── 20261012000001-create-users.js
│   │   ├── 20261012000002-create-refresh-tokens.js
│   │   ├── 20261012000003-create-audit-logs.js
│   │   └── umzug.js               # Migration runner
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   └── adminController.js
│   ├── services/
│   │   ├── authService.js
│   │   ├── tokenService.js
│   │   ├── userService.js
│   │   └── auditService.js
│   ├── middleware/
│   │   ├── authenticate.js
│   │   ├── authorize.js
│   │   ├── validateRequest.js
│   │   ├── rateLimiter.js
│   │   ├── requestId.js
│   │   └── errorHandler.js
│   ├── validators/
│   │   ├── authValidators.js
│   │   └── userValidators.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── userRoutes.js
│   │   ├── adminRoutes.js
│   │   └── index.js
│   ├── utils/
│   │   ├── ApiError.js
│   │   ├── asyncHandler.js
│   │   ├── asyncLock.js            # In-process keyed lock (SQLite rotation)
│   │   ├── crypto.js
│   │   └── response.js
│   ├── docs/
│   │   └── swagger.js             # OpenAPI definition
│   ├── app.js                     # Express app (no listen)
│   └── server.js                  # Starts the server
├── tests/
│   ├── helpers/                   # DB setup, factories, shared helpers
│   ├── auth.test.js
│   ├── user.test.js
│   ├── admin.test.js
│   └── security.test.js
├── docs/
│   └── architecture.md
├── scripts/
│   ├── db.mjs                     # migrate up/down/status
│   ├── dev-db.mjs                 # start/stop MySQL via Docker
│   ├── run-tests.mjs              # Jest ESM runner
│   └── seed-admin.mjs             # admin bootstrap
├── .env.example
├── .gitignore
├── docker-compose.yml
├── eslint.config.js
├── jest.config.mjs
├── package.json
└── README.md
```

---

## 6. Prerequisites

- **Node.js 18+** and **npm** — check with `node -v` and `npm -v`
- **MySQL 8** running locally **or** **Docker Desktop** (the bundled
  `docker-compose.yml` starts a MySQL container for you)
- **Git** (optional, for publishing)

---

## 7. Installation

```bash
# 1. Go into the project
cd auth-microservice

# 2. Install dependencies
npm install

# 3. Create your private environment file
#    Windows (PowerShell):
Copy-Item .env.example .env
#    Linux / macOS:
# cp .env.example .env

# 4. Generate a strong JWT secret and paste it into .env (JWT_ACCESS_SECRET)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 8. Database setup (MySQL)

You need a database named `auth_microservice_db`. Two options:

### Option A — Docker (easiest, recommended)

The repo includes a compose file that starts MySQL 8.4.

```bash
# Start MySQL (waits until it is accepting connections)
npm run dev:db

# If you ever need a clean database (DELETES all data)
npm run dev:db reset
```

Make sure `MYSQL_ROOT_PASSWORD` in your `.env` matches the password inside
`DATABASE_URL`. With the defaults both are `postgres`.

### Option B — Local MySQL server

```sql
CREATE DATABASE auth_microservice_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Then point `DATABASE_URL` in `.env` at it, e.g.:

```
DATABASE_URL=mysql://root:your_password@127.0.0.1:3306/auth_microservice_db
MYSQL_ROOT_PASSWORD=your_password
MYSQL_DATABASE=auth_microservice_db
```

---

## 9. Environment variables

All configuration lives in `.env` (never committed). See `.env.example` for the
full documented list. The important ones:

| Variable | Purpose | Example |
|----------|---------|---------|
| `PORT` | HTTP port | `3000` |
| `NODE_ENV` | `development` / `test` / `production` | `development` |
| `DB_DIALECT` | Active Sequelize dialect: `mysql` (default) or `sqlite` | `mysql` |
| `DATABASE_URL` | MySQL connection string (required when `DB_DIALECT=mysql`) | `mysql://root:postgres@127.0.0.1:3306/auth_microservice_db` |
| `DB_STORAGE` | SQLite file path (used only when `DB_DIALECT=sqlite`) | `./.tmp/auth.sqlite` |
| `MYSQL_ROOT_PASSWORD` | Password for the Docker MySQL container | `postgres` |
| `MYSQL_DATABASE` | Database created by the container | `auth_microservice_db` |
| `JWT_ACCESS_SECRET` | **Strong** signing secret (>= 32 chars in prod) | random hex |
| `JWT_ACCESS_EXPIRES_IN` | Access-token lifetime | `15m` |
| `JWT_ISSUER` | JWT issuer claim | `auth-microservice` |
| `JWT_AUDIENCE` | JWT audience claim | `auth-api` |
| `REFRESH_TOKEN_TTL_DAYS` | Refresh-token lifetime | `7` |
| `BCRYPT_SALT_ROUNDS` | bcrypt cost factor | `12` |
| `CORS_ORIGIN` | Comma-separated allowed origins | `http://localhost:5173` |
| `LOGIN_RATE_LIMIT_MAX` | Max login attempts per window | `10` |
| `ADMIN_NAME/EMAIL/PASSWORD` | Used only by `db:seed:admin` | — |

**Startup validation:** the app refuses to start if `JWT_ACCESS_SECRET` is
missing, or if the secret is a known placeholder. When `DB_DIALECT=mysql`
(the default) `DATABASE_URL` is also required. In production a wildcard
`CORS_ORIGIN=*` is rejected.

> **MySQL vs SQLite.** Production and normal local development use **MySQL**.
> `DB_DIALECT=sqlite` exists strictly as a portable fallback (e.g. a machine
> without a MySQL server) and is what the automated test suite uses by default.

---

## 10. Database migrations

Migrations create the `users`, `refresh_tokens` and `audit_logs` tables (plus
indexes and foreign keys). They are **not** run automatically on startup.

```bash
npm run db:migrate          # apply all pending migrations
npm run db:migrate:undo     # revert the most recent migration
npm run db:migrate:status   # list executed vs pending migrations
```

Migration files are reversible (`up` / `down`).

---

## 11. Administrator bootstrap

There is **no public endpoint that creates admins** — that would be a serious
security hole. Instead, create the first administrator with a one-off script:

```bash
# Set credentials (or put them in .env)
#   Windows PowerShell:
$env:ADMIN_NAME="Administrator"
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="ChangeMe_Before_Using_In_Prod_12345!"

npm run db:seed:admin
```

The script runs pending migrations, then creates (or promotes) the admin
idempotently. It never prints the password, and credentials are never committed.

---

## 12. Starting the application

```bash
# development (auto-restarts on file changes)
npm run dev

# production-style
npm start
```

Once running:

- API base: <http://localhost:3000/api/v1>
- Swagger UI: <http://localhost:3000/api-docs>
- Health: <http://localhost:3000/health>

---

## 13. API endpoints

Base path: **`/api/v1`**

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | – | Register a USER |
| POST | `/auth/login` | – | Login, returns access + refresh tokens |
| POST | `/auth/refresh` | refresh token in body | Rotate refresh token, new pair |
| POST | `/auth/logout` | Bearer | Revoke a refresh token (or all) |
| POST | `/auth/change-password` | Bearer | Change password, revoke sessions |

### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/me` | Bearer | Get own profile |
| PATCH | `/users/me` | Bearer | Update own name / email |

### Admin (requires `ADMIN`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/users` | List users (`?page=&limit=&search=`) |
| GET | `/admin/users/:id` | Get a user by UUID |
| PATCH | `/admin/users/:id/status` | Enable / disable an account |
| PATCH | `/admin/users/:id/role` | Change role (`USER` / `ADMIN`) |
| DELETE | `/admin/users/:id` | Delete a user |

### Status codes used

`200`, `201`, `400`, `401`, `403`, `404`, `409`, `429`, `500`.

---

## 14. JWT authentication explained

1. **Login** returns two tokens:
   - an **access token** (short-lived, default 15 minutes), and
   - a **refresh token** (opaque random string, valid 7 days by default).

2. The client sends the access token on each request:

   ```
   Authorization: Bearer <access_token>
   ```

3. The `authenticate` middleware verifies the token's **signature, expiry,
   issuer and audience**, then loads the user from the database and confirms the
   account is active. It attaches `{ id, role }` to the request.

4. When the access token expires, the client calls `/auth/refresh` with the
   refresh token. The server:
   - looks up the token **by its SHA-256 hash**,
   - checks it is not expired or revoked,
   - revokes it and issues a **new** refresh token (rotation),
   - returns a fresh access token.

5. If an **already-revoked** refresh token is ever presented (a sign of theft),
   **all** of that user's refresh tokens are revoked and they must log in again.

The access token only contains `sub` (user id), `role`, `iss`, `aud`, `iat`, `exp`.
It never contains passwords or personal data.

---

## 15. Role-based authorization explained

- Every new registration gets the `USER` role. Registration can never request
  `ADMIN`.
- The `authorize('ADMIN')` middleware guards all `/admin/*` routes.
- **The role is always read from the database**, not from the token. If an admin
  promotes a user, that user's very next request is treated as an admin — even
  with a token issued before the promotion.
- A `USER` calling an admin endpoint gets **403 Forbidden**; a request with no
  valid token gets **401 Unauthorized**.
- Safeguards: admins cannot change their own role/status or delete themselves,
  and the last active admin cannot be disabled, demoted or deleted.

---

## 16. Swagger documentation

With the server running, open:

- **Swagger UI:** <http://localhost:3000/api-docs>
- **Raw OpenAPI JSON:** <http://localhost:3000/api-docs.json>

Every endpoint documents its method, URL, body, headers, required role, and the
possible success/error responses. You can “Try it out” directly from the UI:
register, log in, copy the access token, click **Authorize**, and call protected
routes.

---

## 17. Automated testing

Tests use **Jest + Supertest**. By default they run against a throwaway
**SQLite** database (created per test file in the OS temp directory), so no
database server is required:

```bash
npm test
npm run test:coverage
```

To run the same suite against **MySQL** instead, start MySQL and opt in with:

```bash
# Windows PowerShell
$env:TEST_DB_DIALECT="mysql"; npm test
# bash
TEST_DB_DIALECT=mysql npm test
```

In MySQL mode an isolated `auth_microservice_test_db` is created automatically
(derived from `DATABASE_URL`); it never touches your development data.

What is covered:

- **Registration:** success, invalid email, weak password, duplicate, ADMIN
  attempt, missing fields.
- **Login:** success, wrong password, unknown email, disabled account, missing
  fields.
- **JWT:** missing / malformed / bad-signature / expired / wrong issuer / wrong
  audience / valid tokens, disabled user.
- **Refresh:** success, expired, revoked, rotation, reuse (family revocation),
  concurrent refresh, access-token-as-refresh rejected.
- **Logout & password change:** revocation of sessions.
- **Profile:** get, update, role-change attempt, protected fields, duplicate
  email.
- **Admin:** pagination, get by UUID, invalid UUID, status, role, delete,
  self-operation and last-admin safeguards.
- **Security:** Helmet headers, CORS, request IDs, malformed JSON, 404 contract,
  rate limiting, no secret leakage, Swagger availability.

---

## 18. Postman testing examples

Import a new collection or just use these raw examples.

**Register**

```http
POST http://localhost:3000/api/v1/auth/register
Content-Type: application/json

{ "name": "Vishnu", "email": "vishnu@example.com", "password": "StrongPassword123!" }
```

**Login**

```http
POST http://localhost:3000/api/v1/auth/login
Content-Type: application/json

{ "email": "vishnu@example.com", "password": "StrongPassword123!" }
```

Copy `data.accessToken` from the response. For protected calls add the header:

```
Authorization: Bearer <accessToken>
```

**Get profile**

```http
GET http://localhost:3000/api/v1/users/me
Authorization: Bearer <accessToken>
```

**Refresh**

```http
POST http://localhost:3000/api/v1/auth/refresh
Content-Type: application/json

{ "refreshToken": "<refreshToken from login>" }
```

**Admin: list users (ADMIN token required)**

```http
GET http://localhost:3000/api/v1/admin/users?page=1&limit=10
Authorization: Bearer <adminAccessToken>
```

> Tip: in Postman create an environment variable `accessToken` and set it from
> the login response with a test script:
> `pm.environment.set("accessToken", pm.response.json().data.accessToken);`

---

## 19. Common errors and solutions

| Symptom | Cause | Fix |
|---------|-------|-----|
| `[Config] Missing required environment variable: DATABASE_URL (required for the MySQL dialect)` | `.env` missing/not loaded, or `DB_DIALECT=mysql` without a URL | Copy `.env.example` to `.env`, or use `DB_DIALECT=sqlite` |
| `[Config] JWT_ACCESS_SECRET is set to an insecure placeholder` | Placeholder secret | Generate a random 64-byte hex secret |
| `ECONNREFUSED` / `connect ETIMEDOUT` on startup | MySQL not running | `npm run dev:db` or start MySQL |
| `Access denied for user 'root'` | Password mismatch | Make `MYSQL_ROOT_PASSWORD` match the password in `DATABASE_URL` |
| `Table 'auth_microservice_db.users' doesn't exist` | Migrations not run | `npm run db:migrate` |
| Tests fail to connect (MySQL mode) | `TEST_DB_DIALECT=mysql` but MySQL unreachable | Start MySQL, or omit it to use SQLite (default) |
| `429 Too Many Requests` on login | Login rate limit hit | Wait for the window, or raise `LOGIN_RATE_LIMIT_MAX` |
| Everything 500 after changing env | Old server process | Restart with `npm run dev` |

---

## 20. Security considerations

- **Passwords** are hashed with bcrypt (cost 12) and never returned or logged.
- **Refresh tokens** are stored only as SHA-256 hashes and rotate on every use;
  reuse revokes the whole family.
- **Access tokens** are short-lived and validated for signature, expiry, issuer
  and audience.
- **Roles** are trusted only from the database, never from the client.
- **Rate limiting** protects login and refresh endpoints from brute force.
- **Helmet** sets safe HTTP headers; **CORS** is an explicit allow-list (never a
  wildcard with credentials).
- **Input validation** and **mass-assignment protection** (services whitelist
  fields) prevent malformed or extra fields from being persisted.
- **Transactions** protect the security-critical refresh operation.
- **Audit logs** record sensitive admin actions.
- **Secrets** live in `.env`, are validated at startup, and `.env*` is gitignored.

### Known trade-off

Access tokens **cannot be revoked before they expire** (they are stateless). A
password change or logout invalidates refresh tokens, but an access token issued
before that stays valid until its short expiry. This is standard for JWT systems;
see the next section for the fix if immediate revocation is required.

---

## 21. Publishing to GitHub

```bash
# (first time only)
git init
git add .
git commit -m "feat: role-based auth microservice with JWT, RBAC and tests"

git branch -M main
git remote add origin https://github.com/<your-username>/auth-microservice.git
git push -u origin main
```

**Before pushing, confirm `.env` is NOT staged** (`git status`). The `.gitignore`
already excludes `.env`, `.env.*` (except `.env.example`), `node_modules/`,
`coverage/` and local DB volumes.

Suggested commit message style:

- `feat: add refresh-token rotation`
- `fix: protect last active administrator`
- `test: add admin pagination tests`
- `docs: expand README setup guide`

---

## 22. Limitations and future improvements

**Limitations**

- Uses **MySQL** rather than the specification's PostgreSQL (see the note in
  [section 3](#3-technology-stack)). Migration is straightforward.
- Access tokens cannot be revoked before expiry (no denylist / token version).
- **Email verification** and **password recovery** are **not implemented** — they
  require an email provider and were left out rather than faked.
- Tokens are returned in the JSON body (no HTTP-only cookie flow).

**Future improvements**

- Migrate to PostgreSQL (`pg`, `dialect: 'postgres'`, `JSONB`).
- Add email verification and password reset (e.g. Nodemailer / SES).
- Add a refresh-token denylist or `tokenVersion` column for instant access-token
  revocation.
- Add multi-factor authentication (TOTP).
- Add Redis-backed rate limiting for multi-instance deployments.
- Add Docker Compose for the API itself and CI (GitHub Actions) to run tests on
  every push.
- Add per-tenant roles / permissions.

---

## License

MIT — created for the Arrowstack Technologies Full Stack Development internship.
