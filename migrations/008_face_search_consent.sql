alter table public.families
  add column face_search_consent boolean not null default false,
  add column face_search_consent_at timestamptz,
  add column face_search_consent_version text,
  add column face_search_index_pending boolean not null default false;

alter table public.families
  add constraint families_face_search_consent_check
  check (
    (face_search_consent = false and face_search_consent_at is null and face_search_consent_version is null)
    or (
      face_search_consent = true
      and face_search_consent_at is not null
      and face_search_consent_version = 'face-search-v1'
    )
  );

  alter table public.families
    add constraint families_face_search_index_pending_check
    check (not face_search_consent or not face_search_index_pending);

create table if not exists public.face_search_audit (
  id bigint generated always as identity primary key,
  volunteer_id uuid not null references public.volunteers(id) on delete cascade,
  searched_at timestamptz not null default now(),
  result_count integer not null check (result_count >= 0)
);

create index if not exists face_search_audit_volunteer_date_idx
  on public.face_search_audit (volunteer_id, searched_at desc);

create index if not exists face_search_audit_expiry_idx
  on public.face_search_audit (searched_at);
