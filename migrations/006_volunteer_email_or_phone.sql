alter table public.volunteers
  alter column phone drop not null;

alter table public.volunteers
  add constraint volunteers_contact_check
  check (email is not null or phone is not null);
