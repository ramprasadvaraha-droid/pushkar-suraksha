# Pushkar Suraksha

A mobile-first Pushkaram family-safety PWA built with the patched Next.js App Router, TypeScript, Tailwind CSS, Framer Motion, and Neon. It uses Neon Postgres for family/member/report data, self-managed Better Auth with email and Indian mobile sign-in, SMTP email delivery, MSG91 SMS OTPs, and a private Neon Object Storage bucket for photos. It includes family/member registration, private photo uploads, printable member slips, Pushkar-day dress photos, missing reports, an organizer-approved volunteer desk with handover counts, and a privacy-limited public found board.

> **Runtime note:** Next.js 14 was requested, but the available Next 14 release has unresolved critical security advisories. This project uses patched Next.js 16 instead; the requested App Router architecture and React workflow are retained.

## Run locally

1. Use Node.js 20 or newer and npm.
2. Link this checkout to the existing `pushkar-suraksha` Neon project and branch. Run [`schema.sql`](./schema.sql) in the Neon SQL Editor to create the app and Better Auth tables if this is a new database. This config no longer uses Neon Managed Auth; existing `neon_auth` data is left untouched.
3. This project declares the private `family-photos` bucket in [`neon.ts`](./neon.ts). Review `neon config plan`, then run `neon deploy` to provision it on the linked branch. The CLI can pull the branch's S3 environment variables into `.env.local`.
4. Configure authentication, email, SMS, one or more organizer email addresses (comma-separated), and the scheduler secret in `.env.local`:

   ```dotenv
   BETTER_AUTH_SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
   BETTER_AUTH_URL=http://localhost:3000
   SMTP_HOST=YOUR_SMTP_HOST
   SMTP_PORT=587
   SMTP_USER=YOUR_SMTP_USERNAME
   SMTP_PASSWORD=YOUR_SMTP_PASSWORD
   SMTP_FROM=Pushkar Suraksha <no-reply@example.com>
   MSG91_AUTH_KEY=YOUR_MSG91_AUTH_KEY
   MSG91_OTP_TEMPLATE_ID=YOUR_MSG91_OTP_TEMPLATE_ID
   VOLUNTEER_ADMIN_EMAILS=organizer@example.com
   CRON_SECRET=YOUR_RANDOM_SCHEDULER_SECRET
   ```

   Keep `.env.local` private and never commit or share it. Neon supplies `DATABASE_URL` and the `AWS_*` storage credentials for the linked branch. Generate `BETTER_AUTH_SECRET` with at least 32 characters. Configure an MSG91 OTP template and SMTP credentials before testing email or mobile sign-in. Do not expose server-only values through `NEXT_PUBLIC_` variables.

5. If the linked database was created using the previous UUID `owner_id` schema, apply [`migrations/001_neon_auth_owner_ids.sql`](./migrations/001_neon_auth_owner_ids.sql) after reviewing and testing it on a Neon branch. This migration converts owner IDs to text for auth-provider user IDs while preserving the composite ownership constraints.
6. Apply [`migrations/002_photo_retention_until_september_2027.sql`](./migrations/002_photo_retention_until_september_2027.sql) on a tested Neon branch to set the photo retention deadline to September 30, 2027 at 11:59 PM India time.
7. Apply [`migrations/003_volunteer_registration_and_handover_counts.sql`](./migrations/003_volunteer_registration_and_handover_counts.sql) on a tested Neon branch to enable individual volunteer registration, organizer approvals, and handover counts.
8. Apply [`migrations/004_better_auth_and_alternative_phone.sql`](./migrations/004_better_auth_and_alternative_phone.sql) on a tested Neon branch before using the new authentication or alternative-number feature. It creates Better Auth tables and adds an optional alternate mobile number; it does not delete the old `neon_auth` schema or migrate users.
9. Apply [`migrations/005_volunteer_phone_auth.sql`](./migrations/005_volunteer_phone_auth.sql) on a tested Neon branch to allow volunteer accounts authenticated only by verified mobile number.
10. Apply [`migrations/006_volunteer_email_or_phone.sql`](./migrations/006_volunteer_email_or_phone.sql) on a tested Neon branch to allow volunteer profiles with either verified email or verified mobile contact.
11. Start the app:

   ```bash
   npm install
   npm run dev
   ```

   Open `http://localhost:3000`. To type-check and create a production build, run `npm run typecheck` and `npm run build`.

This app no longer uses Supabase. Existing Supabase projects, data, Auth identities, and Storage objects are not deleted or migrated by this code change. The linked Neon app tables were empty when this migration was prepared.

The registration form starts with **Ramulu Family** as an editable family-name example. On a fresh database the first family number is `PK-FAM-0842`; later four-digit numbers are randomly allocated under a database lock, with a unique constraint preventing duplicates. Each member receives a unique number such as `PK-08421`.

## Deploy to Vercel

Link this repository to the correct Vercel project and set these production environment variables from the linked Neon branch and your provider configuration: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the production app URL), `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `MSG91_AUTH_KEY`, `MSG91_OTP_TEMPLATE_ID`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `VOLUNTEER_ADMIN_EMAILS`, and `CRON_SECRET`. Keep all credentials server-only; do not use `NEXT_PUBLIC_` names for them.

The `vercel.json` configuration runs `/api/maintenance/cleanup` daily at 00:00 India Standard Time (18:30 UTC). Vercel sends `CRON_SECRET` in the authorization header for this scheduled request.

## Neon setup and operational requirements

- Families can register or sign in with an email address and email verification, or with an Indian mobile number verified by an MSG91 OTP. Email users can set a password or sign in with an email code. Family registration also accepts an optional alternative mobile number, stored privately with the family record and not exposed to volunteers. The same verified email or mobile number restores access on another device; keep the printed member slips as a backup.
- Better Auth sessions use same-origin cookies and API routes enforce ownership in SQL. The app writes auth tables to the linked Postgres database; email verification and OTP delivery require the configured SMTP provider, and mobile verification requires MSG91. The old Neon Auth data is neither migrated nor deleted. Photo uploads are sent to the app server, which validates family membership and writes to the private Neon bucket. Reads return short-lived presigned URLs; object-storage credentials remain server-only.
- Volunteers register with their full name, one email address or Indian mobile number, and a password. Email addresses must be verified by email; mobile numbers must be verified by MSG91 SMS, and phone registrants set their password after verification. The verified email or phone is the volunteer's contact; no second mobile number is required. New applications remain pending until an organizer approves them. Verified emails listed in `VOLUNTEER_ADMIN_EMAILS` can review pending registrations and are approved automatically.
- The family verification secret is stored as a password hash; the slip shows only its first-character hint. An approved volunteer must verify the guardian's secret before the parent's phone number is revealed. The volunteer must then explicitly confirm the physical handover. Only that final confirmation increments the volunteer's personal count and the event total, updates the found board, and removes the member from the active missing list. A verification claim is held for up to 15 minutes.
- The public found board intentionally returns only member number, face photo, and found ghat; parent phone is returned only after an authorized, verified volunteer action.
- Families can permanently delete all of their stored photos from the Family screen by checking the confirmation box and choosing **Delete all photos**. This removes the Neon Storage objects and photo metadata while leaving family/member records intact. Copies already saved on personal or volunteer devices are not removed.
- Photos are marked to expire on September 30, 2027 at 11:59 PM India time. The Vercel cron schedule calls `GET /api/maintenance/cleanup` daily with `Authorization: Bearer <CRON_SECRET>`; the endpoint removes expired objects from Neon Object Storage before deleting their Neon metadata. On other app hosts, configure an equivalent daily scheduler.
- Volunteer missing-list JSON and recently loaded private photo links are cached locally for offline identification. The service worker keys the list cache to the approved volunteer profile, stores no parent phone/name in that list, expires offline photo entries after 12 hours, and clears both caches on volunteer logout. Use a managed device and log out when finished.
- Face and blur checks run on the device before upload. The browser's native `FaceDetector` is required; current Chromium browsers support it, while browsers without it receive an explicit message to use Chrome. The focus check is a client-side quality heuristic, not a medical-grade or forensic identity check.
- Serve the app over HTTPS in production; service-worker install and camera capture require a secure context. Review Neon backups, storage retention, volunteer access, and local child-photo handling before festival deployment.

## Features

- Adults: one face photo. Children under 18: face close-up, full-body, side, and with-family photos.
- On-device face presence and blur checks, with the requested Telugu-transliterated rejection message.
- Database-generated family/member numbers, private family records, signed slip PDF downloads, and photo replacement for today's dress.
- One-tap missing report with a ghat, approved-volunteer search by number, guardian verification, physical-handover confirmation and per-volunteer/event handover counts, and a public privacy-limited found board.
- Installable PWA manifest, offline app shell, and volunteer-list cache.
