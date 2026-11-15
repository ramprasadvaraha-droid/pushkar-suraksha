alter table public.volunteer_handover_verifications
  add column if not exists verification_method text not null default 'secret'
  check (verification_method in ('secret', 'coordinator'));

alter table public.volunteer_handovers
  add column if not exists verification_method text not null default 'secret'
  check (verification_method in ('secret', 'coordinator'));
