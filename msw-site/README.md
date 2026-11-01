# MSW Site

A secure, mobile-first site information app for **MSW UK Ltd**: the right drawings, RAMS and site instructions for each operative, plus photos, issues and progress reported straight back to MSW Contracts.

**Operational information only.** There is no commercial functionality: no orders, rates, values, invoices or purchasing, and none in the database schema either.

---

## Quick start (demo mode, no accounts or keys needed)

Requires Node.js 20.9+.

```bash
cd msw-site
```

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000.

`npm run dev` creates a demo database on first run, in `./.data` (about 3 seconds). It uses fictional data and generated drawing and RAMS PDFs. The login page has one-tap buttons for the demo accounts. **All demo accounts use the password `SiteDemo!2026`.**

To start the demo again from scratch:

```bash
npm run demo:reset
```

To test on a phone on the same Wi-Fi, run `npm run dev -- -H 0.0.0.0` and open `http://<your-computer-ip>:3000`.

For a production build in demo mode:

```bash
npm run build && npm start
```

### Demo accounts and what each one shows

| Person | Account | What to look for |
|---|---|---|
| **Claire Morgan** | MSW administrator (Contracts Manager) | Dashboard; grant or revoke access; approve drawings; respond to reports |
| **Sam Patel** | MSW office (Document Controller) | Manages documents and reports; **can't** change access |
| **John Smith** | ABC Decking, Gang A | Sees **only** British Museum, **only** Levels 1–2 drawings |
| **Mark Jones** | ABC Decking, Gang A | Same as John (email `mark.jones@abcdecking.example`) |
| **Liam Turner** | Northern Edge, Gang B | Same job, **only** Levels 3–4 drawings and netting RAMS |
| **Paul Brown** | ABC Decking (not allocated to British Museum) | Can't see British Museum, even by direct URL. Sees Riverside only |
| **Steve Wilson** | ABC Decking (same as Paul) | `steve.wilson@abcdecking.example` |
| **Dave Clarke** | ABC Decking director (manager) | Granted British Museum only, with ABC's reports. **Not** Riverside, where his other gang works |
| **Sarah Booth** | Northern Edge manager | No grants, so she sees nothing |
| **Gareth Evans** | MSW direct operative | All areas of British Museum |

Other accounts follow the pattern `first.last@<company>.example`. **Kieran Walsh** shows a revoked allocation and **Danny Ward** a deactivated account.

### A five-minute walkthrough of the access model

1. Sign in as **John**. He has one job, his allocation "Level 1 · Level 2", and only Level 1/2 and whole-job drawings. Open DK‑101 and pinch or scroll to zoom: fine print is legible at high zoom.
2. Sign in as **Paul** (same company). British Museum isn't listed. Opening a British Museum link directly gives a **404**, and so does the PDF URL.
3. Sign in as **Claire**, then go to Jobs → British Museum → **People & access**. Tap **ABC Decking Ltd**, tick **Steve Wilson**, choose **Level 3** and click **Give access to 1 person**. Steve now sees the job with only the Level 3 drawings. The change is in the job's **Activity** tab, and Steve has a notification.
4. As **Sam**: Drawings & RAMS → DK‑103 → **Approve for use** on draft C02. C01 becomes superseded and stays visible to the office only. Liam, Ryan and Gareth (Level 3) are notified; Gang A isn't. **Who has it** shows who has opened the new revision.
5. As **Liam**: Report an issue → *Safety concern*. The app tells him to phone the site manager now and offers a tap-to-call button. Add a photo and send. It appears on Claire's dashboard and in her notifications.

---

## What's built

**Office dashboard** (desktop, works on tablets)
- Dashboard: live jobs, open and urgent issues, recent reports, drafts awaiting approval, issues needing a response, a recent activity feed, and an active-jobs table showing people, open issues, drafts and last activity.
- Jobs: create and edit (job number, project, address and postcode, directions, what3words, main contractor, site contact and phone, dates, status, induction link and notes, site instructions, MSW contracts manager). Searchable and filterable for dozens of live jobs.
- Floors, phases and areas per job (add, rename, reorder; deleting an area that's in use is blocked).
- Drawings and RAMS: PDF upload with progress. Drawing number, title, revision, change note, upload date and approval status. Area scoping. Approve, withdraw, reinstate or delete drafts. Full revision history. "Who has it" (opened / not opened) for the current revision.
- **People & access**: choose a company, tick individual operatives (or select all), choose all areas or specific floors and phases, add attendance dates and a note, and grant in **one action**. Edit someone's allocation in place (no duplicate records). Bulk revoke. Previous-access history.
- Directory: companies; MSW employees and subcontractor operatives; invite, edit, change role or employer, deactivate (signs the person out and removes all access), reset password.
- Site reports inbox with filters; conversation thread; status workflow (open → in progress → resolved / closed); priority; share photos with the team for one area.
- Append-only activity history (job, document, access, report and people changes, plus document opens).

**Operative app** (mobile-first, large touch targets)
- **My Jobs**: only explicitly allocated jobs, each showing the allocated area, attendance dates and "updated this week" badges.
- **Job**: one-tap **Call site**, **Directions**, **Report an issue**, **Progress update**; induction link; site instructions; current approved drawings with area filter chips; RAMS with the hard-copy-briefing notice; my reports and MSW replies; site photos; site and MSW contacts; an urgent-safety reminder.
- **PDF viewer**: pinch or scroll zoom up to 16×, pan, double-tap zoom, fit and download. Each page gets a base render within mobile canvas limits, plus a full-resolution **detail tile** of the visible area once a gesture settles, so small annotations stay sharp.
- **Reporting**: issue categories (delay, access, missing edge protection, materials, drawing query, safety, other), priority, area, description. Camera capture or gallery (up to 8 photos), resized in the browser for weak signal. Progress bar on upload; the draft is kept if sending fails. Progress updates and photo uploads.
- Notifications: added to or removed from a job; allocation changed; drawing updated or withdrawn; site information changed; office reply or status change.

---

## Architecture

```
Next.js 16 (App Router, server components + server actions)  ── TypeScript, Tailwind CSS v4
        │
        │  every read/write:  withUser(userId) → BEGIN; SET LOCAL ROLE authenticated;
        │                     set_config('request.jwt.claims', {sub: userId}); …; COMMIT
        ▼
PostgreSQL with Row-Level Security  (supabase/migrations/*.sql — the single source of truth)
   ├─ production: Supabase Postgres  (driver: node-postgres)
   └─ demo/tests: PGlite (embedded Postgres via WASM) running the SAME migrations
Auth:     Supabase Auth (production) | local scrypt password + server-side sessions (demo)
Files:    private Supabase Storage bucket (production) | private ./.data/storage (demo)
          → always streamed through /api/files/* after an RLS-checked lookup
```

**Why this design.** Authorisation lives in the database, not the UI. The app's server runs every business query the way Supabase's own API does: switched to the `authenticated` role, with the user's id as the JWT subject. A missing check in a page therefore can't leak data, because Postgres won't return rows the user may not see. The same policies protect the Supabase REST API if anyone uses the public anon key directly.

**Why PGlite for demo mode.** It is real Postgres compiled to WebAssembly. Demo mode and the automated tests execute the exact production migrations: policies, triggers and functions. They are not a mock with separate rules.

### Key files

| Path | Purpose |
|---|---|
| `supabase/migrations/…_core_schema.sql` | Tables, constraints and indexes. No commercial fields. |
| `supabase/migrations/…_access_control.sql` | RLS helpers, policies and grants: **the access model** |
| `supabase/migrations/…_workflows_audit.sql` | Grant/revoke, approve/withdraw and respond functions; audit and notification triggers |
| `supabase/migrations/…_storage.sql` | Private bucket and `storage.objects` read policy (Supabase only) |
| `db/local-supabase-shim.sql` | Demo only: emulates `auth.uid()`, roles and `auth.users` for PGlite |
| `src/server/db/` | Drivers, migrations runner, `withUser` / `withSystem` |
| `src/server/auth/` | Supabase and local sessions, `getViewer` / `requireStaff` / `requireAdmin` |
| `src/server/files/` | Authorised file streaming, upload workflows, PDF and image validation |
| `src/server/actions/` | Server actions (zod-validated) |
| `src/server/queries/` | Read models for site and office screens |
| `src/components/pdf/pdf-viewer.tsx` | Zoom/pan PDF viewer with detail-tile rendering |
| `src/server/seed/` | Fictional demo data, PDF and photo generators |
| `tests/`, `e2e/` | Vitest (database and file pipeline) and Playwright (browser) tests |

---

## Security model

- **Individual allocation only.** A non-office user sees a job only through an active `job_assignments` row for **them**. Company membership grants nothing. Managers get nothing automatically.
- **Areas.** An assignment is "all areas" or a set of floors and phases. Documents scoped to areas are visible only to people allocated to at least one of them; whole-job documents go to everyone on the job.
- **Approval status.** Outside the office, only the single `approved` revision of a document exists. Draft, superseded and withdrawn revisions are invisible, and a unique index guarantees there is at most one approved revision per document.
- **Admin-only access changes.** `grant_job_access` and `revoke_job_access` check the caller is an MSW admin, and RLS enforces the same. Office users can view access but not change it.
- **Reports.** The author, timestamps, content and company are set by a trigger and are immutable. Spoofed `author_id` or `created_at` values are overwritten. You can only report on jobs and areas you are allocated to. Only office users can change status. Managers see their own company's reports on a job only if `can_view_company_reports` is set on **their** assignment to that job.
- **Files.** No public URLs. `/api/files/*` returns 404 unless the RLS-checked lookup succeeds, with `Cache-Control: no-store`. Upload paths are server-generated UUIDs. PDFs are checked for a PDF header. Photos are decoded and re-encoded server-side, which strips EXIF/GPS and rejects non-images.
- **Audit.** `activity_log` is written only by SECURITY DEFINER triggers. API roles have no insert, update or delete privilege on it.
- **Secrets.** The service-role key and `DATABASE_URL` are read only in server modules (marked `server-only`). The browser only ever receives the anon key, in Supabase mode.
- **Other.** Login rate limiting, scrypt password hashing (demo), constant-time comparison, HTTP-only SameSite session cookies, same-origin checks on upload routes, framing denied, `nosniff`, and no indexing.
- **Deactivation.** All access stops immediately (the RLS helpers require `profiles.active`). Demo sessions are deleted; in Supabase mode the account is also banned in Auth.

---

## Tests and checks

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run test:e2e
```

`npm test` runs **46** Vitest tests against the real migrations in PGlite (about 8 seconds). `npm run test:e2e` runs **10** Playwright tests: it builds the app and starts an isolated demo server on port 3100.

What the tests cover:
- The British Museum scenario exactly as specified (John/Mark yes; Paul/Steve no; other subcontractors no; owner not automatic).
- Level 1–2 versus Level 3–4 gangs on the same job, for documents and areas.
- Draft and superseded revisions hidden; one approved revision per document; approval notifies only the right people.
- Admin-only grants (operative, manager and office all rejected); one-action multi-person grants; in-place updates without duplicates; revoke; deactivate.
- No directory, audit-log or other-notification leakage; no self-escalation; the anon role has no access; internal helpers are not callable.
- Report spoofing (author and timestamps) overwritten; reporting outside your allocation rejected; immutability; manager report visibility.
- Direct file URL attempts return 404, including out-of-area, superseded and logged-out requests; EXIF stripping; non-image and non-PDF rejection; no orphaned files after a denied upload.
- Browser: mobile operative flow, the PDF viewer rendering, an issue with a photo, the safety prompt, an admin granting access through the UI, office reply → operative notification, and approval superseding the previous revision.

All of these pass in this environment.

---

## Moving to production on Supabase

The Supabase integration is **implemented but has not been run against a live Supabase project**: no credentials were available while building. Everything below the auth and storage adapters is the same code that runs and is tested in demo mode. Expect to check these steps on first deployment.

1. **Create a Supabase project** in a UK/EU region (for example London, `eu-west-2`).

2. **Apply the migrations** with the Supabase CLI:

   ```bash
   supabase link --project-ref <ref>
   ```

   ```bash
   supabase db push
   ```

   This creates the schema, RLS policies, functions and the private `msw-private` bucket. Do **not** apply `db/local-supabase-shim.sql` to Supabase.

3. **Configure the environment** (`.env.local` or your host): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL`. Use the pooler connection string; transaction mode is fine. Also set `NEXT_PUBLIC_SITE_URL`. See `.env.example`. With all four Supabase variables set, the app switches to Supabase mode automatically.

4. **Auth settings** in the Supabase dashboard:
   - Turn **off** public sign-ups. Accounts are created only by MSW admins through invitations.
   - Under **URL configuration**, add `https://<your-domain>/auth/confirm` to the redirect URLs.
   - Edit the **Invite user** and **Reset password** email templates so their links use the token-hash flow:
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/account`
     (use `type=recovery` for password reset).
   - Configure custom SMTP so invitation emails come from an MSW address. Supabase's built-in mailer is heavily rate-limited.

5. **Create the first administrator.** Invite yourself from the Supabase dashboard (Authentication → Users). Then run this once in the SQL editor:

   ```sql
   insert into companies (name, is_msw) values ('MSW UK Ltd', true);
   insert into profiles (id, company_id, full_name, email, role)
   select u.id, c.id, 'Your Name', u.email, 'admin' from auth.users u, companies c
   where u.email = 'you@msw.co.uk' and c.is_msw;
   ```

6. **Optional demo data in a non-production project:** `npm run seed:supabase -- --yes`.

7. **Deploy.** Any Node host (`npm run build && npm start`) works. On Vercel, serverless request bodies are capped at about 4.5 MB, which would limit PDF uploads. Either self-host or containerise, or switch drawing uploads to Supabase signed upload URLs (not implemented in this release).

### Working versus simulated

| Capability | Demo mode | Supabase mode |
|---|---|---|
| Database, RLS, triggers, audit | **Working** (PGlite, same SQL) | Implemented; same SQL, not run live here |
| Sign-in / sessions | **Working** (local scrypt + server sessions) | Implemented with Supabase Auth; not run live |
| Inviting users | **Simulated**: a temporary password is shown once on screen; no email | Supabase invitation email (needs SMTP and templates) |
| Password reset | **Simulated**: admin generates a temporary password | Supabase reset email |
| File storage | **Working** (private local folder) | Private Supabase Storage bucket (implemented) |
| Notifications | **Working** in-app | **Working** in-app |
| Email / SMS / push alerts | Not built | Not built |
| Offline drawings | Not built (deliberate, see below) | Not built |

---

## Known limitations and sensible next steps

- **No offline drawing access.** The PWA is installable and shows an offline notice, but it deliberately doesn't cache documents. Caching would put confidential drawings on devices outside access control and risk working from a superseded revision. If offline access is needed, it should be designed as an explicit feature: per-job opt-in, revision checks and expiry.
- **No email, SMS or push notifications.** Notifications are in-app only.
- **Login rate limiting is in-memory**, so it is per server instance. Supabase Auth adds its own limits in production.
- **Large uploads** go through the app server (about 50 MB limit); see the Vercel note above.
- **"Who has it"** records authenticated opens and downloads. It is not proof that someone read or was briefed on a drawing, and the app doesn't replace RAMS briefings or signatures.
- **No virus scanning** of uploaded PDFs; consider adding a scanning step for production. Photos are always re-encoded.
- **No Supabase realtime subscriptions.** Pages show fresh data on each navigation or refresh.
