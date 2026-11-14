alter table public.photos
  alter column expires_at set default '2027-09-30 23:59:00+05:30'::timestamptz;

update public.photos
set expires_at = '2027-09-30 23:59:00+05:30'::timestamptz;
