alter table public.members
  drop constraint members_family_id_owner_id_fkey;

alter table public.photos
  drop constraint photos_family_id_owner_id_fkey,
  drop constraint photos_member_id_owner_id_fkey;

alter table public.missing_logs
  drop constraint missing_logs_member_id_owner_id_fkey;

alter table public.families
  alter column owner_id type text using owner_id::text;

alter table public.members
  alter column owner_id type text using owner_id::text;

alter table public.photos
  alter column owner_id type text using owner_id::text;

alter table public.missing_logs
  alter column owner_id type text using owner_id::text;

alter table public.members
  add constraint members_family_id_owner_id_fkey
  foreign key (family_id, owner_id)
  references public.families (id, owner_id)
  on delete cascade;

alter table public.photos
  add constraint photos_family_id_owner_id_fkey
  foreign key (family_id, owner_id)
  references public.families (id, owner_id)
  on delete cascade,
  add constraint photos_member_id_owner_id_fkey
  foreign key (member_id, owner_id)
  references public.members (id, owner_id)
  on delete cascade;

alter table public.missing_logs
  add constraint missing_logs_member_id_owner_id_fkey
  foreign key (member_id, owner_id)
  references public.members (id, owner_id)
  on delete cascade;
