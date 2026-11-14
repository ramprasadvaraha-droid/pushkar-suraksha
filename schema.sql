create extension if not exists pgcrypto;

create table if not exists "user" (
  "id" text not null primary key,
  "name" text not null,
  "email" text not null unique,
  "emailVerified" boolean not null,
  "image" text,
  "createdAt" timestamptz default current_timestamp not null,
  "updatedAt" timestamptz default current_timestamp not null,
  "phoneNumber" text unique,
  "phoneNumberVerified" boolean
);

create table if not exists "session" (
  "id" text not null primary key,
  "expiresAt" timestamptz not null,
  "token" text not null unique,
  "createdAt" timestamptz default current_timestamp not null,
  "updatedAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references "user" ("id") on delete cascade
);

create table if not exists "account" (
  "id" text not null primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user" ("id") on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz default current_timestamp not null,
  "updatedAt" timestamptz not null
);

create table if not exists "verification" (
  "id" text not null primary key,
  "identifier" text not null,
  "value" text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz default current_timestamp not null,
  "updatedAt" timestamptz default current_timestamp not null
);

create index if not exists "session_userId_idx" on "session" ("userId");
create index if not exists "account_userId_idx" on "account" ("userId");
create index if not exists "verification_identifier_idx" on "verification" ("identifier");

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  family_name text not null check (length(trim(family_name)) between 2 and 100),
  phone text check (phone is null or phone ~ '^[6-9][0-9]{9}$'),
  alternative_phone text constraint families_alternative_phone_check check (
    alternative_phone is null
    or (alternative_phone ~ '^[6-9][0-9]{9}$' and alternative_phone <> phone)
  ),
  district text not null check (length(trim(district)) between 2 and 80),
  family_number text not null unique check (family_number ~ '^PK-FAM-[0-9]{4}$'),
  verification_secret_hash text not null,
  verification_hint text not null,
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  owner_id text not null,
  name text not null check (length(trim(name)) between 1 and 100),
  age integer not null check (age between 0 and 120),
  relation text not null check (relation in ('Father', 'Mother', 'Son', 'Daughter', 'Other')),
  gender text not null check (gender in ('Male', 'Female', 'Other')),
  member_number text not null unique check (member_number ~ '^PK-[0-9]{5}$'),
  status text not null default 'safe' check (status in ('safe', 'missing', 'found')),
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (family_id, owner_id) references public.families(id, owner_id) on delete cascade
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  member_id uuid not null,
  owner_id text not null,
  photo_type text not null check (photo_type in ('face_front', 'full_body', 'side', 'with_family', 'dress_today')),
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default '2027-09-30 23:59:00+05:30'::timestamptz,
  foreign key (family_id, owner_id) references public.families(id, owner_id) on delete cascade,
  foreign key (member_id, owner_id) references public.members(id, owner_id) on delete cascade
);

create table if not exists public.missing_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null,
  owner_id text not null,
  ghat text not null check (length(trim(ghat)) between 2 and 100),
  missing_at timestamptz not null default now(),
  found_at timestamptz,
  found_ghat text check (found_ghat is null or length(trim(found_ghat)) between 2 and 100),
  foreign key (member_id, owner_id) references public.members(id, owner_id) on delete cascade
);

create table if not exists public.volunteers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null unique,
  email text,
  full_name text not null check (length(trim(full_name)) between 2 and 100),
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (status in ('approved', 'rejected') and reviewed_at is not null and reviewed_by is not null)
  ),
  check (email is not null or phone is not null)
);

create table if not exists public.volunteer_handover_verifications (
  missing_log_id uuid primary key references public.missing_logs(id) on delete cascade,
  volunteer_id uuid not null references public.volunteers(id) on delete cascade,
  ghat text not null check (length(trim(ghat)) between 2 and 100),
  verified_at timestamptz not null default now()
);

create table if not exists public.volunteer_handovers (
  missing_log_id uuid primary key references public.missing_logs(id) on delete cascade,
  volunteer_id uuid not null references public.volunteers(id) on delete restrict,
  handed_over_at timestamptz not null default now()
);

create index if not exists families_owner_created_idx
  on public.families (owner_id, created_at desc);
create index if not exists members_family_created_idx
  on public.members (family_id, created_at);
create index if not exists photos_member_type_created_idx
  on public.photos (member_id, photo_type, created_at desc);
create index if not exists photos_expiry_idx
  on public.photos (expires_at);
create index if not exists missing_logs_open_idx
  on public.missing_logs (missing_at desc) where found_at is null;
create index if not exists volunteers_pending_idx
  on public.volunteers (created_at) where status = 'pending';
create index if not exists volunteer_handovers_volunteer_date_idx
  on public.volunteer_handovers (volunteer_id, handed_over_at desc);
create unique index if not exists one_open_missing_log_per_member
  on public.missing_logs (member_id) where found_at is null;
