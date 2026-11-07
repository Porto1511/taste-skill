-- =============================================================================
-- Timesheets: several entries per day (one per job/site visited), each with
-- what was done there.  A day is reviewed by the office as a whole.
-- =============================================================================

alter table public.timesheets drop constraint if exists timesheets_one_per_day;

alter table public.timesheets
  add column work_done text[] not null default '{}'
    check (work_done <@ array['deck', 'studs', 'netting', 'edge_trims', 'concrete', 'edge_protection', 'other']::text[]),
  add column work_description text
    check (work_description is null or length(work_description) <= 1000);

create index timesheets_user_date_idx on public.timesheets (user_id, work_date);

-- One notification per day reviewed, not one per entry.
create or replace function app.audit_timesheets()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
  v_day text;
  v_href text;
begin
  if new.status is not distinct from old.status or new.status = 'submitted' then
    return null;
  end if;
  select p.full_name into v_name from public.profiles p where p.id = new.user_id;
  v_day := to_char(new.work_date, 'Dy DD Mon');
  v_href := '/timesheet/' || new.work_date;
  if exists (
    select 1 from public.notifications n
    where n.user_id = new.user_id and n.href = v_href and n.kind = 'timesheet.' || new.status
      and n.created_at > app.now() - interval '2 minutes'
  ) then
    return null;
  end if;
  perform app.write_activity(new.job_id, 'timesheet.' || new.status, 'timesheet', new.id,
    'Timesheet for ' || v_name || ' (' || v_day || ') ' || case when new.status = 'approved' then 'approved' else 'queried' end);
  perform app.notify(new.user_id, 'timesheet.' || new.status,
    case when new.status = 'approved' then 'Timesheet approved: ' || v_day else 'Timesheet query: ' || v_day end,
    coalesce(new.office_note, case when new.status = 'approved' then 'No action needed.' else 'Please check and resubmit.' end),
    v_href, new.job_id);
  return null;
end;
$$;
