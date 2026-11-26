-- Wording: subcontractor "bosses" are called managers on screen.
update public.job_assignments set note = 'Company manager' where note = 'Company boss';

create or replace function app.job_companies_changed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_company text;
  v_job public.jobs;
  v_user uuid;
begin
  select c.name into v_company from public.companies c where c.id = new.company_id;
  select * into v_job from public.jobs j where j.id = new.job_id;
  if tg_op = 'INSERT' then
    insert into public.job_assignments (job_id, user_id, all_areas, can_view_company_reports, granted_by, note)
    select new.job_id, p.id, true, true, new.granted_by, 'Company manager'
    from public.profiles p
    where p.company_id = new.company_id and p.active and p.role = 'manager'
      and not exists (select 1 from public.job_assignments a
                      where a.job_id = new.job_id and a.user_id = p.id and a.revoked_at is null);
    perform app.write_activity(new.job_id, 'company.granted', 'job_company', new.id,
      v_company || ' given the job');
    for v_user in select p.id from public.profiles p
                  where p.company_id = new.company_id and p.active and p.role = 'manager' loop
      perform app.notify(v_user, 'company.granted', 'MSW have given you ' || v_job.job_number || ' — ' || v_job.name,
        'Tick which of your people can see it.', '/company/jobs/' || new.job_id, new.job_id);
    end loop;
  elsif new.revoked_at is not null and old.revoked_at is null then
    update public.job_assignments a
       set revoked_at = coalesce(new.revoked_at, app.now()), revoked_by = new.revoked_by
     where a.job_id = new.job_id and a.revoked_at is null
       and a.user_id in (select p.id from public.profiles p where p.company_id = new.company_id);
    perform app.write_activity(new.job_id, 'company.revoked', 'job_company', new.id,
      v_company || ' taken off the job');
    for v_user in select p.id from public.profiles p
                  where p.company_id = new.company_id and p.active and p.role = 'manager' loop
      perform app.notify(v_user, 'company.revoked', v_job.job_number || ' has been taken off ' || v_company,
        'Your people can no longer see this job.', '/company', null);
    end loop;
  end if;
  return null;
end;
$$;

create or replace function public.boss_add_operative(
  p_id uuid, p_full_name text, p_email text, p_phone text, p_job_title text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_company uuid := app.my_company_id();
  v_company_name text;
  v_admin uuid;
begin
  if not app.is_company_boss() then
    raise exception 'Only the manager of a company can add its people' using errcode = '42501';
  end if;
  insert into public.profiles (id, company_id, full_name, email, phone, job_title, role, invited_at)
  values (p_id, v_company, trim(p_full_name), p_email, nullif(trim(p_phone), ''), nullif(trim(p_job_title), ''), 'operative', now());
  select c.name into v_company_name from public.companies c where c.id = v_company;
  perform app.write_activity(null, 'person.added', 'profile', p_id, trim(p_full_name) || ' added to ' || v_company_name);
  for v_admin in select * from app.admin_recipients() loop
    perform app.notify(v_admin, 'person.added', v_company_name || ' added ' || trim(p_full_name),
      coalesce(nullif(trim(p_job_title), ''), 'Operative'), '/office/people/' || p_id, null);
  end loop;
end;
$$;
