# NYAYA Finance Platform

A financial request management platform built with Next.js 14, Supabase, and NextAuth.js for NYAYA Youth Affairs.

## Features

- **Role-based access**: Requesters and Admins with separate dashboards
- **Request lifecycle**: Submit → Review → Approve/Reject → Mark Paid → Upload Receipt → Complete
- **Email notifications**: Automated emails via Resend at every status change
- **Audit logging**: Full audit trail for all actions
- **In-app notifications**: Real-time notification bell with unread count
- **CSV export**: Admin can export all requests to CSV
- **File uploads**: Supporting documents and payment receipts via Supabase Storage
- **TypeScript**: Fully typed throughout

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | Supabase (PostgreSQL) |
| Auth | NextAuth.js v5 + Supabase Auth |
| Styling | Tailwind CSS |
| Forms | React Hook Form + Zod |
| Email | Resend |
| UI Icons | Lucide React |

## Getting Started

### 1. Clone and install

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (keep secret)
- `NEXTAUTH_SECRET` - Random secret (min 32 chars), generate with: `openssl rand -base64 32`
- `NEXTAUTH_URL` - Your app URL (e.g. `http://localhost:3000`)
- `RESEND_API_KEY` - Your Resend API key
- `EMAIL_FROM` - Sender email address

### 3. Set up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL schema in the Supabase SQL editor:
   ```
   supabase/schema.sql
   ```
3. Create storage buckets in the Supabase dashboard:
   - `request-documents` (private)
   - `receipts` (private)

### 4. Create an admin user

After running the schema, sign up through the app and then manually update the user role in Supabase:

```sql
UPDATE public.users SET role = 'admin' WHERE email = 'your-admin@example.com';
```

### 5. Run development server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Project Structure

```
satgo-finance-platform/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx          # Login page
│   │   └── signup/page.tsx         # Registration page
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Dashboard shell with sidebar
│   │   ├── requester/
│   │   │   ├── page.tsx            # Requester dashboard
│   │   │   ├── new-request/        # New request form
│   │   │   └── requests/[id]/      # Request detail (requester view)
│   │   └── admin/
│   │       ├── page.tsx            # Admin dashboard
│   │       └── requests/
│   │           ├── page.tsx        # All requests (admin)
│   │           └── [id]/page.tsx   # Request detail with actions
│   ├── api/
│   │   ├── auth/[...nextauth]/     # NextAuth handler
│   │   ├── requests/               # CRUD + status endpoints
│   │   ├── export/                 # CSV export
│   │   └── notifications/          # Notification management
│   ├── layout.tsx                  # Root layout
│   └── page.tsx                    # Root redirect
├── components/
│   ├── ui/                         # Button, Input, Badge, Card, Modal
│   ├── layout/                     # Sidebar, Header
│   └── requests/                   # RequestForm, RequestTable, RequestCard, StatusBadge
├── lib/
│   ├── supabase/                   # client.ts, server.ts, admin.ts
│   ├── auth.ts                     # NextAuth config
│   ├── email.ts                    # Resend email templates
│   ├── types.ts                    # TypeScript interfaces
│   └── utils.ts                    # Utility functions
└── supabase/
    └── schema.sql                  # Complete database schema
```

## Request Status Flow

```
pending → approved → paid → completed
        ↘ rejected
```

- **pending**: Submitted, awaiting admin review
- **approved**: Admin approved, awaiting payment
- **rejected**: Admin rejected (with reason)
- **paid**: Payment processed by admin
- **completed**: Receipt uploaded, request fully closed

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/requests` | List requests (filtered by role) |
| POST | `/api/requests` | Create new request |
| GET | `/api/requests/[id]` | Get single request |
| PATCH | `/api/requests/[id]` | Update request |
| DELETE | `/api/requests/[id]` | Delete request |
| POST | `/api/requests/[id]/approve` | Admin: approve |
| POST | `/api/requests/[id]/reject` | Admin: reject with reason |
| POST | `/api/requests/[id]/paid` | Admin: mark as paid |
| POST | `/api/requests/[id]/receipt` | Admin: upload receipt |
| GET | `/api/export` | Admin: download CSV |
| GET | `/api/notifications` | Get notifications |
| PATCH | `/api/notifications` | Mark all as read |

## Currency

All amounts are in Nigerian Naira (NGN). The currency formatting uses `en-NG` locale.

## Deployment

### Vercel (recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add all environment variables
4. Deploy

```bash
npm run build  # Test build locally first
```
