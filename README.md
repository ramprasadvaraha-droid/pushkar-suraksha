# Pushkar Suraksha

A mobile-first Pushkaram family-safety PWA built with the patched Next.js App Router, TypeScript, Tailwind CSS, Framer Motion, and Neon. It uses Neon Postgres for family/member/report data, Neon Managed Better Auth for email/password sign-in with email-code verification, and a private Neon Object Storage bucket for photos. New phone OTP signup is disabled because Firebase does not offer real-number SMS verification on its free Spark plan. The app includes family/member registration, private photo uploads, printable member slips, Pushkar-day dress photos, missing reports, an organizer-approved volunteer desk with handover counts, and a privacy-limited public found board.

> **Runtime note:** Next.js 14 was requested, but the available Next 14 release has unresolved critical security advisories. This project uses patched Next.js 16 instead; the requested App Router architecture and React workflow are retained.

## Run locally

1. Use Node.js 22.x and npm.
2. Link this checkout to the existing `pushkar-suraksha` Neon project and branch. Run [`schema.sql`](./schema.sql) in the Neon SQL Editor to create the app tables if this is a new database. Neon Managed Auth owns its tables in the `neon_auth` schema; do not create Better Auth tables in `public`.
3. This project declares Managed Auth and the private `family-photos` bucket in [`neon.ts`](./neon.ts). Review `neon config plan`, then run `neon deploy` to reconcile services on the linked branch and pull its environment variables into `.env.local`.
4. Configure the Neon Auth cookie secret, one or more organizer email addresses (comma-separated), and the scheduler secret in `.env.local`:

   ```dotenv
   NEON_AUTH_BASE_URL=YOUR_BRANCH_NEON_AUTH_URL
   NEON_AUTH_COOKIE_SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
   VOLUNTEER_ADMIN_EMAILS=organizer@example.com
   CRON_SECRET=YOUR_RANDOM_SCHEDULER_SECRET
   ```

   `neon deploy` supplies `NEON_AUTH_BASE_URL`, `DATABASE_URL`, and the `AWS_*` storage credentials. Generate `NEON_AUTH_COOKIE_SECRET` with at least 32 characters. Keep `.env.local` private and never commit or share it. Configure Neon Auth's email provider in the Neon Console; use custom SMTP for production. Do not expose server-only values through `NEXT_PUBLIC_` variables.

5. If the linked database was created using the previous UUID `owner_id` schema, apply [`migrations/001_neon_auth_owner_ids.sql`](./migrations/001_neon_auth_owner_ids.sql) after reviewing and testing it on a Neon branch. This migration converts owner IDs to text for auth-provider user IDs while preserving the composite ownership constraints.
6. Apply [`migrations/002_photo_retention_until_september_2027.sql`](./migrations/002_photo_retention_until_september_2027.sql) on a tested Neon branch to set the photo retention deadline to September 30, 2027 at 11:59 PM India time.
7. Apply [`migrations/003_volunteer_registration_and_handover_counts.sql`](./migrations/003_volunteer_registration_and_handover_counts.sql) on a tested Neon branch to enable individual volunteer registration, organizer approvals, and handover counts.
8. Apply [`migrations/004_better_auth_and_alternative_phone.sql`](./migrations/004_better_auth_and_alternative_phone.sql) on a tested Neon branch to add an optional alternate mobile number. Its legacy self-managed Better Auth tables are unused by Neon Managed Auth and are not deleted automatically.
9. Apply [`migrations/005_volunteer_phone_auth.sql`](./migrations/005_volunteer_phone_auth.sql) on a tested Neon branch to allow volunteer accounts authenticated only by verified mobile number.
10. Apply [`migrations/006_volunteer_email_or_phone.sql`](./migrations/006_volunteer_email_or_phone.sql) on a tested Neon branch to allow volunteer profiles with either verified email or verified mobile contact.
11. New accounts use Neon Auth email verification codes. In the linked branch's Neon Console, enable **Sign-up and Sign-in with Email**, **Verify at Sign-up**, and **Verification code**. The app already sends and verifies these codes through the Neon Auth SDK. Neon documents its shared SMTP as rate-limited and for development/testing; production requires a custom SMTP provider. Email delivery is not guaranteed to be free or unlimited: the SMTP provider's quotas and policies apply. See [Neon's production checklist](https://neon.com/docs/auth/production-checklist.md) and [Email OTP guide](https://neon.com/docs/auth/guides/plugins/email-otp.md). Firebase does **not** provide a Spark-plan allowance of 10 real-number OTPs per day: Firebase's current [pricing](https://firebase.google.com/pricing) lists Phone Auth as unavailable on Spark and billed per SMS on Blaze, and its [Auth limits](https://firebase.google.com/docs/auth/limits) confirm SMS verification is Blaze-only. This app does not request real phone SMS; do not enable Firebase Phone Auth expecting free real-user OTPs. Existing Firebase phone accounts, if any, need a separate verified migration plan before removing their legacy configuration. The previously applied `migrations/007_phone_auth_schema.sql` belongs to the retired Better Auth phone path; do not delete its schema without confirming it contains no accounts.
12. Apply [`migrations/008_face_search_consent.sql`](./migrations/008_face_search_consent.sql) on a tested Neon branch. Existing families remain opted out. Follow [`face-search-service/README.md`](./face-search-service/README.md) to start the private Python 3.12 service, configure its persistent encrypted vector database, and set `FACE_SEARCH_SERVICE_URL` and `FACE_SEARCH_SERVICE_TOKEN` for Next.js before accepting new registrations.
13. Apply [`migrations/009_coordinator_handover_fallback.sql`](./migrations/009_coordinator_handover_fallback.sql) on a tested Neon branch. It records whether a completed handover used the guardian secret or the in-person organizer fallback.
14. Start the app:

   ```bash
   npm install
   npm run dev
   ```

   Open `http://localhost:3000`. To type-check and create a production build, run `npm run typecheck` and `npm run build`.

This app no longer uses Supabase. Existing Supabase projects, data, Auth identities, and Storage objects are not deleted or migrated by this code change. The linked Neon app tables were empty when this migration was prepared.

The family name, phone numbers, and home district fields start empty. On a fresh database the first family number is `PK-FAM-0842`; later four-digit numbers are randomly allocated under a database lock, with a unique constraint preventing duplicates. Each member receives a unique number such as `PK-08421`.

## Deploy to Hostinger

Deploy this project as a Node.js 22.x application in Hostinger hPanel; it needs the Next.js server for API routes and cannot run as a static-only site. Configure the app to run `npm run build` and `npm start`. Set the environment variables from the linked Neon branch and app configuration, including `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, the `AWS_*` storage values, `VOLUNTEER_ADMIN_EMAILS`, `CRON_SECRET`, `FACE_SEARCH_SERVICE_URL`, and `FACE_SEARCH_SERVICE_TOKEN`. Configure a production SMTP provider for Neon Auth as described above, and add the production origin to Neon Auth's trusted domains in the Neon Console. Enable SSL for the domain. No Firebase phone-auth configuration is needed for new accounts. If you previously configured Firebase phone auth, remove its old environment variables before rebuilding; this disables legacy Firebase phone sessions, so migrate any such accounts first. Configure a daily Hostinger cron job to call `/api/maintenance/cleanup` with `Authorization: Bearer <CRON_SECRET>`.

## Neon setup and operational requirements

- Families register with a verified email and password using Neon Managed Auth. New Firebase phone signups are disabled; any existing Firebase phone accounts require a separately verified migration/linking plan before their legacy configuration is removed. Do not link identities by matching phone/email strings alone. Keep printed member slips as a backup.
- Neon Managed Better Auth stores email sessions in the branch's `neon_auth` schema. Same-origin API routes check the active authenticated identity and enforce family ownership in SQL. Photo uploads are sent to the app server, which validates family membership and writes to the private Neon bucket. Reads return short-lived presigned URLs; object-storage credentials remain server-only.
- Volunteers register with their full name, verified email, and password. New applications remain pending until an organizer approves them. Verified organizer emails listed in `VOLUNTEER_ADMIN_EMAILS` can review pending registrations and are approved automatically.
- The family verification secret is stored as a password hash; the slip shows only its first-character hint. An approved volunteer must verify the guardian's secret before the parent's phone number is revealed. If the guardian forgot it, only a verified organizer may use the fallback after personally checking the guardian in person; that same organizer must complete the handover. The verification method is recorded. The volunteer must explicitly confirm the physical handover. Only that final confirmation increments the volunteer's personal count and the event total, updates the found board, and removes the member from the active missing list. A verification claim is held for up to 15 minutes.
- The public found board intentionally returns only member number, face photo, and found ghat; parent phone is returned only after an authorized, verified volunteer action.
- Families can permanently delete all of their stored photos from the Family screen by checking the confirmation box and choosing **Delete all photos**. This removes the Neon Storage objects and photo metadata while leaving family/member records intact. Copies already saved on personal or volunteer devices are not removed.
- New family registration requires explicit consent from an adult member or guardian for secure face-template creation. Existing families are excluded by default. Only consented face photos are indexed; search is restricted to current missing reports and approved volunteers. Deleting family photos disables face search and removes the templates.
- Face search runs through the separate Python FAISS service described in [`face-search-service/README.md`](./face-search-service/README.md). Encrypted templates are stored on a persistent private volume; query photos are processed transiently. The 10-search-per-minute limit and 90-day audit retention apply. Similarity scores are suggestions only, never identity proof; guardian verification by secret or the in-person organizer fallback and physical handover confirmation remain required.
- Photos are marked to expire on September 30, 2027 at 11:59 PM India time. Configure Hostinger's daily cron to call `GET /api/maintenance/cleanup` with `Authorization: Bearer <CRON_SECRET>`; the endpoint removes expired objects from Neon Object Storage before deleting their Neon metadata.
- Volunteer missing-list JSON and recently loaded private photo links are cached locally for offline identification. The service worker keys the list cache to the approved volunteer profile, stores no parent phone/name in that list, expires offline photo entries after 12 hours, and clears both caches on volunteer logout. Use a managed device and log out when finished.
- Face and blur checks run on the device before upload. The browser's native `FaceDetector` is required; current Chromium browsers support it, while browsers without it receive an explicit message to use Chrome. The focus check is a client-side quality heuristic, not a medical-grade or forensic identity check.
- Serve the app over HTTPS in production; service-worker install and camera capture require a secure context. Review Neon backups, storage retention, volunteer access, and local child-photo handling before festival deployment.

## Features

- Adults: face close-up and full-body photos. Children under 18: face close-up, full-body, side, and with-family photos.
- Explicit face-search consent, encrypted FAISS face templates for new consenting registrations, and human-reviewed search on the organizer-approved volunteer screen.
- On-device face presence and blur checks, with the requested Telugu-transliterated rejection message.
- Database-generated family/member numbers, private family records, signed slip PDF downloads, and photo replacement for today's dress.
- One-tap missing report with a ghat, approved-volunteer search by number, guardian verification, physical-handover confirmation and per-volunteer/event handover counts, and a public privacy-limited found board.
- Installable PWA manifest, offline app shell, and volunteer-list cache.
