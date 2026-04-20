# NYAYA Finance Platform

A financial request management platform for NYAYA Youth Affairs (RCCG), built on a **Next.js 14 frontend + Laravel 11 API** monorepo. Handles budget planning, two-tier financial approvals, payment tracking, receipt uploads, and post-event reconciliation for large-scale events (₦500M+ budgets, 16 departments, 100,000+ attendees).

## Architecture

This is a monorepo with two independent apps:

| Directory | Purpose |
|---|---|
| `/` (root) | Next.js 14 frontend (App Router) |
| `/api` | Laravel 11 REST API |

The frontend communicates with the Laravel API via **Laravel Sanctum SPA authentication** (cookie-based, no tokens). Next.js proxies `/api/*` and `/sanctum/*` requests to the Laravel backend in development.

## Two-Tier Request Model

**Tier 1 — Internal Requests** (within departments):
Team members submit requests to their team lead. The team lead approves, rejects, or requests revision. Finance and SATGO have read-only visibility.

**Tier 2 — Finance Requests** (official approval chain):
Team leads consolidate approved internal requests into a single finance request. This flows through:

```
Team Lead submits → Finance reviews → SATGO approves (time-bound)
                                              ↓
                                   Finance records payments (partial/full)
                                              ↓
                                   Team Lead uploads receipts
                                              ↓
                                   Variance calculated → Refund if needed
                                              ↓
                                   Event close → Reconciliation report
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router, TypeScript) |
| Backend | Laravel 11 (modular domain structure) |
| Database | MySQL |
| Auth | Laravel Sanctum (SPA cookie-based) |
| Permissions | Spatie Laravel Permission |
| Audit | Laravel Auditing (owen-it) |
| Storage | Laravel local disk (`storage/app/public`) |
| Email | Resend (via Laravel mail transport) |
| Exports | Maatwebsite Excel |
| PDF | barryvdh/laravel-dompdf |
| Styling | Tailwind CSS |
| Forms | React Hook Form + Zod |
| Animations | Framer Motion |
| UI Icons | Lucide React |
| Deployment | PM2 (Next.js) + PHP-FPM + Nginx |

## Roles

| Role | Capabilities |
|---|---|
| `member` | Submit internal requests, view own |
| `team_lead` | Review department internals, create finance requests, upload receipts |
| `finance_admin` | Finance review, record payments, manage budgets, reconciliation |
| `super_admin` (SATGO) | Final approval/rejection, event management, audit log |

## Getting Started

### Prerequisites

- **Frontend**: Node.js 18+
- **Backend**: PHP 8.3+, Composer, MySQL 8+

### 1. Clone and install dependencies

```bash
# Frontend
npm install

# Backend
cd api && composer install
```

### 2. Configure the Laravel API

```bash
cd api
cp .env.example .env
php artisan key:generate
```

Edit `api/.env` — required values:

```env
APP_NAME="NYAYA Finance"
APP_URL=http://localhost:8001
FRONTEND_URL=http://localhost:3000

DB_CONNECTION=mysql
DB_DATABASE=nyaya_finance
DB_USERNAME=root
DB_PASSWORD=

MAIL_MAILER=resend
RESEND_API_KEY=re_your_key_here
MAIL_FROM_ADDRESS=finance@yourdomain.com

SANCTUM_STATEFUL_DOMAINS=localhost:3000
SESSION_DOMAIN=localhost
```

### 3. Run migrations and seed

```bash
cd api
php artisan migrate:fresh --seed
php artisan storage:link
```

This creates all tables, seeds roles/permissions, request types, and sample data (Mega Music Festival 2026 with 16 departments).

### 4. Configure the Next.js frontend

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8001
API_URL=http://localhost:8001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Start both servers

```bash
# Terminal 1 — Laravel API
cd api && php artisan serve --port=8001

# Terminal 2 — Next.js frontend
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Project Structure

```
nyaya-finance-platform/
├── api/                            # Laravel 11 backend
│   ├── app/
│   │   ├── Modules/                # Domain modules
│   │   │   ├── Auth/               # Login, register, me
│   │   │   ├── User/               # User management
│   │   │   ├── Department/         # Department CRUD
│   │   │   ├── Event/              # Event management + dashboard
│   │   │   ├── RequestType/        # Admin-managed request types
│   │   │   ├── Budget/             # Budget allocation + Excel import
│   │   │   ├── InternalRequest/    # Tier 1 — within departments
│   │   │   ├── FinanceRequest/     # Tier 2 — official approval chain
│   │   │   ├── Notification/       # In-app notifications
│   │   │   ├── Export/             # Excel exports
│   │   │   └── Reconciliation/     # Event close + reports
│   │   ├── Providers/
│   │   │   └── ModuleServiceProvider.php  # Auto-registers all module routes, policies, events
│   │   └── Http/Middleware/
│   │       └── EnsureActiveUser.php
│   ├── database/
│   │   ├── migrations/             # All schema migrations
│   │   └── seeders/
│   │       ├── RolesAndPermissionsSeeder.php
│   │       ├── RequestTypeSeeder.php (via DatabaseSeeder)
│   │       └── DevelopmentSeeder.php
│   ├── deployment/
│   │   ├── deploy.sh               # Laravel deploy script
│   │   ├── deploy-web.sh           # Next.js deploy script
│   │   ├── nginx-api.conf          # Nginx config for API
│   │   └── nginx-web.conf          # Nginx config for frontend
│   └── .env.example
│
├── app/                            # Next.js App Router pages
│   ├── (auth)/
│   │   ├── login/                  # Login page
│   │   └── signup/                 # Registration page
│   └── (dashboard)/
│       ├── dashboard/              # Role-based home dashboard
│       ├── my-requests/            # Member: internal requests
│       ├── team-lead/              # Team lead dashboard
│       ├── finance/                # Finance admin views
│       │   ├── requests/           # Finance request queue
│       │   ├── payments/           # Payment recording
│       │   └── request-types/      # Manage request types
│       ├── admin/                  # SATGO views
│       │   ├── approval-queue/     # Finance-reviewed, awaiting SATGO
│       │   ├── events/             # Event management + budget import
│       │   ├── departments/        # Department management
│       │   ├── users/              # User management
│       │   ├── audit-log/          # Full audit trail
│       │   └── reports/            # Exports
│       ├── notifications/          # Notification inbox
│       └── settings/               # Profile settings
│
├── components/
│   ├── ui/                         # Design system components
│   │   ├── animate-in.tsx          # Framer Motion entrance wrapper
│   │   ├── animated-number.tsx     # Counting number animation
│   │   ├── animated-progress-bar.tsx
│   │   ├── gold-button.tsx         # Primary CTA button
│   │   ├── naira-amount.tsx        # ₦ formatted amount display
│   │   ├── stat-card.tsx           # Dashboard metric card
│   │   ├── status-badge.tsx        # Request status pill
│   │   ├── data-table.tsx          # Sortable data table
│   │   └── empty-state.tsx
│   ├── layout/
│   │   └── sidebar-layout.tsx      # Dashboard shell with animated sidebar
│   └── requests/                   # RequestForm, RequestTable, RequestCard
│
├── lib/
│   ├── api-client.ts               # Sanctum SPA client (browser-side)
│   ├── api-server.ts               # Server-side API fetch helper
│   ├── auth.ts                     # Server-side session → Laravel /me
│   ├── email.ts                    # Email utilities
│   └── utils.ts                    # Formatting helpers (naira, dates)
│
├── middleware.ts                   # Edge auth guard (checks session cookie)
├── ecosystem.config.js             # PM2 config for production
└── .env.example
```

## Finance Request Status Flow

```
submitted → finance_reviewed → satgo_approved → partial_payment ┐
          ↘ finance_rejected   ↘ satgo_rejected  ↓               ↓
                               ↘ approval_expired paid → receipted → refund_pending → refund_completed → completed
                                                                  ↘ completed (if no variance)
```

## API Overview

All routes are prefixed `/api` and require `auth:sanctum` unless noted. Responses follow:

```json
{ "success": true, "data": { ... }, "message": "..." }
```

| Module | Key Endpoints |
|---|---|
| Auth | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |
| Internal Requests | `GET/POST /api/internal-requests`, `POST /{id}/submit`, `POST /{id}/approve` |
| Finance Requests | `GET/POST /api/finance-requests`, `POST /{id}/finance-review`, `POST /{id}/satgo-approve` |
| Payments | `POST /api/finance-requests/{id}/payments` |
| Budgets | `GET/POST /api/events/{id}/budgets`, `POST /import` |
| Events | `GET/POST /api/events`, `GET /{id}/dashboard` |
| Notifications | `GET /api/notifications`, `PATCH /{id}/read` |
| Export | `GET /api/export/requests`, `GET /api/export/budget-summary` |

All monetary fields are returned in both naira (`amount`) and kobo (`amount_kobo`). Stored internally as kobo (integer) to avoid floating point issues.

## Currency

All amounts stored as **kobo** (1 NGN = 100 kobo) in the database. The API converts to/from naira. Frontend displays using `en-NG` locale (₦).

## Deployment (VPS)

### Laravel API

```bash
# On the server
bash /var/www/nyaya-api/api/deployment/deploy.sh
```

Runs: `git pull` → `composer install --no-dev` → config/route/view cache → `migrate --force` → `storage:link` → restart PHP-FPM.

### Next.js Frontend

```bash
bash /var/www/nyaya-api/api/deployment/deploy-web.sh
```

Runs: `git pull` → `npm ci` → `npm run build` → copy standalone assets → `pm2 reload`.

### Production environment notes

- Set `SESSION_SAME_SITE=none` and `SESSION_SECURE_COOKIE=true` in `api/.env` when frontend and API are on different subdomains.
- Set `SESSION_DOMAIN=.yourdomain.com` to share the session cookie across subdomains.
- `APP_DEBUG=false` and `APP_ENV=production` must be set before going live.
- See `api/deployment/nginx-api.conf` and `nginx-web.conf` for Nginx configuration.
