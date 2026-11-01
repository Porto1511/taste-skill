-- =============================================================================
-- MSW Site — private Supabase Storage (applied on Supabase only; demo mode
-- uses a private on-disk store served through the same authorising routes).
--
-- The bucket is PRIVATE.  The application server streams files only after an
-- RLS-checked lookup.  These policies are defence in depth: even a direct
-- Storage API call with a user's own JWT can read only objects that user is
-- allowed to see, and API users can never write or delete objects.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('msw-private', 'msw-private', false, 52428800,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function app.can_read_storage_object(p_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and (
    exists (
      select 1 from public.document_revisions r
      where r.storage_path = p_name and app.user_can_see_revision(auth.uid(), r.id)
    )
    or exists (
      select 1 from public.report_photos ph
      where ph.storage_path = p_name and app.user_can_see_report(auth.uid(), ph.report_id)
    )
  )
$$;
revoke execute on function app.can_read_storage_object(text) from public;
grant execute on function app.can_read_storage_object(text) to authenticated;

drop policy if exists "msw_private_read" on storage.objects;
create policy "msw_private_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'msw-private' and app.can_read_storage_object(name));
-- Deliberately no insert/update/delete policies: only the server (service
-- role, after its own authorisation checks) writes to this bucket.
