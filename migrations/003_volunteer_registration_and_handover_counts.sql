create table if not exists public.volunteers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null unique,
  email text not null,
  full_name text not null check (length(trim(full_name)) between 2 and 100),
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (status in ('approved', 'rejected') and reviewed_at is not null and reviewed_by is not null)
  )
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

create index if not exists volunteers_pending_idx
  on public.volunteers (created_at) where status = 'pending';
create index if not exists volunteer_handovers_volunteer_date_idx
  on public.volunteer_handovers (volunteer_id, handed_over_at desc);
