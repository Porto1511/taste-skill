-- =============================================================================
-- MSW Site — subcontractor bosses run their own people.
--
--   * MSW (administrator) gives a job to a COMPANY (job_companies).  Taking it
--     away cuts off every one of that company's people on that job at once.
--   * The company's boss (role 'manager') automatically sees the whole job
--     and everything their own company records on it.
--   * The boss adds their own operatives (logins), switches them off, files
--     their cards (CSCS, tickets…) and ticks which of them can see each job.
--     Operatives ticked on a job see the whole job (all drawings).
--   * A person from a subcontractor sees a job ONLY while their company has
--     the job AND they personally are ticked on it.
--   * Variations: what the client asked for, signed by the operatives and
--     then the client.  No prices.
--   * Administrators are told whenever a boss changes something.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Jobs given to companies
-- ---------------------------------------------------------------------------
create table public.job_companies (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs (id) on delete cascade,
  company_id  uuid not null references public.companies (id) on delete cascade,
  granted_by  uuid references public.profiles (id),
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  revoked_by  uuid references public.profiles (id)
);
create unique index job_companies_active_key on public.job_companies (job_id, company_id) where revoked_at is null;
create index job_companies_company_idx on public.job_companies (company_id) where revoked_at is null;

create or replace function app.company_has_job(p_company uuid, p_job uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.companies c where c.id = p_company and c.is_msw)
      or exists (select 1 from public.job_companies jc
                 where jc.company_id = p_company and jc.job_id = p_job and jc.revoked_at is null)
$$;

-- An active boss of a subcontractor (not MSW).
create or replace function app.user_is_company_boss(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles p join public.companies c on c.id = p.company_id
                 where p.id = p_user and p.active and p.role = 'manager' and not c.is_msw and c.active)
$$;

create or replace function app.is_company_boss()
returns boolean
language sql stable security definer set search_path = ''
as $$ select app.user_is_company_boss(auth.uid()) $$;

-- Is p_user one of the caller's own people (the caller being a boss)?
create or replace function app.is_my_person(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.user_is_company_boss(auth.uid())
     and exists (select 1 from public.profiles p where p.id = p_user and p.company_id = app.my_company_id())
$$;

-- Active administrators: told about every change a boss makes.
create or replace function app.admin_recipients()
returns setof uuid
language sql stable security definer set search_path = ''
as $$ select p.id from public.profiles p where p.active and p.role = 'admin' $$;

-- Job access now also needs the person's company to hold the job.
create or replace function app.user_job_assignment(p_user uuid, p_job uuid)
returns public.job_assignments
language sql stable security definer set search_path = ''
as $$
  select a.*
  from public.job_assignments a
  join public.profiles p on p.id = a.user_id
  join public.jobs j on j.id = a.job_id and j.status = 'live'
  where a.job_id = p_job
    and a.user_id = p_user
    and a.revoked_at is null
    and p.active
    and app.company_has_job(p.company_id, a.job_id)
  limit 1
$$;

create or replace function app.user_has_area_access(p_user uuid, p_job uuid, p_area uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_user is not null and (
    app.user_is_staff(p_user)
    or exists (
      select 1
      from public.job_assignments a
      join public.profiles p on p.id = a.user_id
      join public.jobs j on j.id = a.job_id and j.status = 'live'
      join public.job_areas ar on ar.id = p_area and ar.job_id = a.job_id
      where a.job_id = p_job
        and a.user_id = p_user
        and a.revoked_at is null
        and p.active
        and app.company_has_job(p.company_id, a.job_id)
        and (
          a.all_areas
          or exists (
            select 1 from public.assignment_areas aa
            where aa.assignment_id = a.id and aa.area_id = p_area
          )
        )
    )
  )
$$;

-- Giving a job to a company: its boss(es) see the whole job straight away.
-- Taking it away: everyone from that company loses the job.
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
    select new.job_id, p.id, true, true, new.granted_by, 'Company boss'
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
create trigger job_companies_changed after insert or update on public.job_companies
  for each row execute function app.job_companies_changed();

-- When MSW ticks a subcontractor person straight onto a job, their company is
-- given the job too (MSW meant them to have it).
create or replace function app.assignment_gives_company()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_company uuid;
begin
  select p.company_id into v_company from public.profiles p
  join public.companies c on c.id = p.company_id and not c.is_msw
  where p.id = new.user_id;
  if v_company is not null and app.is_admin()
     and not exists (select 1 from public.job_companies jc
                     where jc.job_id = new.job_id and jc.company_id = v_company and jc.revoked_at is null) then
    insert into public.job_companies (job_id, company_id, granted_by) values (new.job_id, v_company, auth.uid());
  end if;
  return new;
end;
$$;
create trigger job_assignments_gives_company before insert on public.job_assignments
  for each row execute function app.assignment_gives_company();

-- Existing access: each subcontractor already working on a job holds that job.
insert into public.job_companies (job_id, company_id, granted_by, granted_at)
select distinct on (a.job_id, p.company_id) a.job_id, p.company_id, a.granted_by, a.granted_at
from public.job_assignments a
join public.profiles p on p.id = a.user_id
join public.companies c on c.id = p.company_id and not c.is_msw
where a.revoked_at is null
order by a.job_id, p.company_id, a.granted_at;

-- Bosses already on a job now see all of it, and everything their company records there.
update public.job_assignments a
   set all_areas = true, can_view_company_reports = true
 where a.revoked_at is null and (not a.all_areas or not a.can_view_company_reports)
   and exists (select 1 from public.profiles p join public.companies c on c.id = p.company_id
               where p.id = a.user_id and p.role = 'manager' and not c.is_msw);
delete from public.assignment_areas aa using public.job_assignments a
 where aa.assignment_id = a.id and a.all_areas
   and exists (select 1 from public.profiles p where p.id = a.user_id and p.role = 'manager');

alter table public.job_companies enable row level security;
create policy job_companies_select on public.job_companies for select to authenticated
  using (app.is_staff() or (app.is_company_boss() and company_id = app.my_company_id()));
create policy job_companies_insert on public.job_companies for insert to authenticated
  with check (app.is_admin());
create policy job_companies_update on public.job_companies for update to authenticated
  using (app.is_admin()) with check (app.is_admin());
grant select, insert, update on public.job_companies to authenticated;

-- Jobs a boss's company holds (any status, so lads can be ticked before it goes live).
create or replace function public.my_company_jobs()
returns table (job_id uuid, job_number text, name text, site_address text, status public.job_status, given_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select j.id, j.job_number, j.name, j.site_address, j.status, jc.granted_at
  from public.job_companies jc
  join public.jobs j on j.id = jc.job_id
  where app.is_company_boss() and jc.company_id = app.my_company_id() and jc.revoked_at is null
  order by j.job_number desc
$$;

-- ---------------------------------------------------------------------------
-- 2. A boss sees, adds and switches off their own people
-- ---------------------------------------------------------------------------
create policy profiles_select_my_people on public.profiles for select to authenticated
  using (app.is_company_boss() and company_id = app.my_company_id());
create policy job_assignments_select_my_people on public.job_assignments for select to authenticated
  using (app.is_my_person(user_id));

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
    raise exception 'Only the boss of a company can add its people' using errcode = '42501';
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

create or replace function public.boss_update_operative(
  p_user uuid, p_full_name text, p_phone text, p_job_title text, p_active boolean
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_old public.profiles;
  v_company_name text;
  v_admin uuid;
  v_what text;
begin
  if not app.is_my_person(p_user) then
    raise exception 'Not one of your people' using errcode = '42501';
  end if;
  select * into v_old from public.profiles p where p.id = p_user;
  if v_old.role <> 'operative' then
    raise exception 'Only operatives can be changed here' using errcode = '42501';
  end if;
  update public.profiles
     set full_name = trim(p_full_name), phone = nullif(trim(p_phone), ''), job_title = nullif(trim(p_job_title), ''),
         active = p_active
   where id = p_user;
  select c.name into v_company_name from public.companies c where c.id = v_old.company_id;
  v_what := case when v_old.active and not p_active then 'switched off ' || v_old.full_name
                 when not v_old.active and p_active then 'switched ' || v_old.full_name || ' back on'
                 else 'updated ' || trim(p_full_name) || '''s details' end;
  perform app.write_activity(null, 'person.updated', 'profile', p_user, v_company_name || ' ' || v_what);
  for v_admin in select * from app.admin_recipients() loop
    perform app.notify(v_admin, 'person.updated', v_company_name || ' ' || v_what, '', '/office/people/' || p_user, null);
  end loop;
end;
$$;

-- Before creating a login: is that email already used?  Bosses and the office only.
create or replace function public.email_taken(p_email text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (app.is_company_boss() or app.is_staff())
     and (exists (select 1 from public.profiles p where p.email = lower(trim(p_email)))
          or exists (select 1 from auth.users u where lower(u.email) = lower(trim(p_email))))
$$;

-- Tick (or untick) one of the boss's operatives on a job the company holds.
create or replace function public.boss_set_job_access(p_job uuid, p_user uuid, p_on boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_assignment uuid;
  v_name text;
  v_company_name text;
  v_job public.jobs;
  v_admin uuid;
begin
  if not app.is_my_person(p_user) then
    raise exception 'Not one of your people' using errcode = '42501';
  end if;
  if not exists (select 1 from public.job_companies jc
                 where jc.job_id = p_job and jc.company_id = app.my_company_id() and jc.revoked_at is null) then
    raise exception 'Your company does not have this job' using errcode = '42501';
  end if;
  select p.full_name into v_name from public.profiles p where p.id = p_user and p.role = 'operative';
  if v_name is null then
    raise exception 'Only operatives are ticked onto jobs' using errcode = '22023';
  end if;
  select * into v_job from public.jobs j where j.id = p_job;
  select c.name into v_company_name from public.companies c where c.id = app.my_company_id();
  select a.id into v_assignment from public.job_assignments a where a.job_id = p_job and a.user_id = p_user and a.revoked_at is null;

  if p_on and v_assignment is null then
    if not exists (select 1 from public.profiles p where p.id = p_user and p.active) then
      raise exception 'Switch them back on first' using errcode = '22023';
    end if;
    insert into public.job_assignments (job_id, user_id, all_areas, granted_by, note)
    values (p_job, p_user, true, auth.uid(), 'Added by ' || v_company_name);
  elsif not p_on and v_assignment is not null then
    update public.job_assignments set revoked_at = app.now(), revoked_by = auth.uid() where id = v_assignment;
  else
    return;
  end if;
  for v_admin in select * from app.admin_recipients() loop
    perform app.notify(v_admin, 'company.allocation',
      v_company_name || (case when p_on then ' put ' else ' took ' end) || v_name || (case when p_on then ' on ' else ' off ' end) || v_job.job_number,
      v_job.name, '/office/jobs/' || p_job || '/access', p_job);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Cards and tickets for each person (CSCS, IPAF, FASET…)
-- ---------------------------------------------------------------------------
create table public.operative_cards (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  company_id    uuid not null references public.companies (id) on delete cascade,
  card_type     text not null check (length(trim(card_type)) between 2 and 80),
  card_number   text check (card_number is null or length(card_number) <= 80),
  expires_on    date,
  file_name     text not null check (length(file_name) <= 255),
  file_size     integer not null check (file_size > 0),
  mime_type     text not null check (mime_type in ('application/pdf', 'image/jpeg')),
  storage_path  text not null unique,
  uploaded_by   uuid references public.profiles (id) on delete set null,
  uploaded_by_name text,
  created_at    timestamptz not null default now()
);
create index operative_cards_user_idx on public.operative_cards (user_id, card_type);
create index operative_cards_expiry_idx on public.operative_cards (expires_on);

-- The person themselves, their boss, and the MSW office.
create or replace function app.can_see_cards(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select app.is_staff() or p_user = auth.uid() or app.is_my_person(p_user) $$;

create or replace function app.can_manage_cards(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select app.is_staff() or app.is_my_person(p_user) $$;

create or replace function app.cards_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if app.is_api_context() then
    new.uploaded_by := auth.uid();
    new.created_at := now();
  end if;
  select p.company_id into new.company_id from public.profiles p where p.id = new.user_id;
  select p.full_name into new.uploaded_by_name from public.profiles p where p.id = new.uploaded_by;
  return new;
end;
$$;
create trigger operative_cards_before_insert before insert on public.operative_cards
  for each row execute function app.cards_before_insert();

create or replace function app.audit_cards()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r public.operative_cards;
  v_name text;
  v_company text;
  v_admin uuid;
  v_title text;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  select p.full_name, c.name into v_name, v_company
  from public.profiles p join public.companies c on c.id = p.company_id where p.id = r.user_id;
  v_title := v_company || (case when tg_op = 'DELETE' then ' removed ' else ' added ' end) || r.card_type || ' for ' || v_name;
  perform app.write_activity(null, case when tg_op = 'DELETE' then 'card.removed' else 'card.added' end, 'card', r.id, v_title);
  if app.is_api_context() and not app.is_staff() then
    for v_admin in select * from app.admin_recipients() loop
      perform app.notify(v_admin, 'card.changed', v_title,
        case when r.expires_on is null then 'No expiry date' else 'Expires ' || to_char(r.expires_on, 'DD Mon YYYY') end,
        '/office/people/' || r.user_id, null);
    end loop;
  end if;
  return null;
end;
$$;
create trigger operative_cards_audit after insert or delete on public.operative_cards
  for each row execute function app.audit_cards();

alter table public.operative_cards enable row level security;
create policy operative_cards_select on public.operative_cards for select to authenticated
  using (app.can_see_cards(user_id));
create policy operative_cards_insert on public.operative_cards for insert to authenticated
  with check (app.can_manage_cards(user_id));
create policy operative_cards_delete on public.operative_cards for delete to authenticated
  using (app.can_manage_cards(user_id));
grant select, insert, delete on public.operative_cards to authenticated;

-- Company certificates: everyone in the company can see them (to show on
-- site); only the boss or the MSW office add or remove them.
create or replace function app.can_edit_certificates(p_company uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.user_is_staff(auth.uid())
      or exists (select 1 from public.profiles p join public.companies c on c.id = p.company_id
                 where p.id = auth.uid() and p.active and p.company_id = p_company and (c.is_msw or p.role = 'manager'))
$$;
drop policy company_certificates_insert on public.company_certificates;
drop policy company_certificates_delete on public.company_certificates;
create policy company_certificates_insert on public.company_certificates for insert to authenticated
  with check (app.can_edit_certificates(company_id));
create policy company_certificates_delete on public.company_certificates for delete to authenticated
  using (app.can_edit_certificates(company_id));

create or replace function app.audit_certificates()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r public.company_certificates;
  v_company text;
  v_admin uuid;
  v_title text;
begin
  if not app.is_api_context() or app.is_staff() then
    return null;
  end if;
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  select c.name into v_company from public.companies c where c.id = r.company_id;
  v_title := v_company || (case when tg_op = 'DELETE' then ' removed the certificate ' else ' added the certificate ' end) || r.title;
  perform app.write_activity(null, 'certificate.changed', 'certificate', r.id, v_title);
  for v_admin in select * from app.admin_recipients() loop
    perform app.notify(v_admin, 'certificate.changed', v_title, '', '/office/certificates', null);
  end loop;
  return null;
end;
$$;
create trigger company_certificates_audit after insert or delete on public.company_certificates
  for each row execute function app.audit_certificates();

-- ---------------------------------------------------------------------------
-- 4. Variations: what the client asked for, signed by the operatives then
--    the client.  A record of the instruction — no prices.
-- ---------------------------------------------------------------------------
create table public.variations (
  id                     uuid primary key default gen_random_uuid(),
  job_id                 uuid not null references public.jobs (id) on delete cascade,
  area_id                uuid references public.job_areas (id) on delete set null,
  description            text not null check (length(trim(description)) between 3 and 4000),
  requested_by           text not null check (length(trim(requested_by)) between 2 and 120),
  operatives             jsonb not null default '[]'::jsonb,
  operative_signer_name  text not null check (length(trim(operative_signer_name)) between 2 and 120),
  operative_signature_path text not null unique,
  client_name            text not null check (length(trim(client_name)) between 2 and 120),
  client_position        text check (client_position is null or length(client_position) <= 120),
  client_company         text not null check (length(trim(client_company)) between 2 and 160),
  client_email           text check (client_email is null or length(client_email) <= 200),
  client_signature_path  text not null unique,
  captured_by            uuid not null references public.profiles (id),
  captured_by_name       text not null,
  captured_by_company    text not null,
  captured_by_company_id uuid not null references public.companies (id),
  signed_at              timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  constraint variations_operatives check (jsonb_typeof(operatives) = 'array' and jsonb_array_length(operatives) between 1 and 20)
);
create index variations_job_idx on public.variations (job_id, signed_at desc);

create table public.variation_photos (
  id            uuid primary key default gen_random_uuid(),
  variation_id  uuid not null references public.variations (id) on delete cascade,
  storage_path  text not null unique,
  caption       text check (caption is null or length(caption) <= 300),
  file_size     integer,
  width         integer,
  height        integer,
  created_at    timestamptz not null default now()
);
create index variation_photos_idx on public.variation_photos (variation_id);

-- Office; the person who raised it while on the job; their company's boss.
create or replace function app.can_see_variation(p_variation uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.variations v
    where v.id = p_variation
      and (
        app.user_is_staff(auth.uid())
        or (v.captured_by = auth.uid() and app.user_has_job_access(auth.uid(), v.job_id))
        or app.user_can_see_report_row(auth.uid(), v.job_id, null, '00000000-0000-0000-0000-000000000000'::uuid, v.captured_by_company_id, false)
      )
  )
$$;

create or replace function app.variations_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if app.is_api_context() then
    new.captured_by := auth.uid();
    new.signed_at := now();
    new.created_at := now();
  end if;
  select p.full_name, c.name, c.id into new.captured_by_name, new.captured_by_company, new.captured_by_company_id
  from public.profiles p join public.companies c on c.id = p.company_id where p.id = new.captured_by;
  if new.captured_by_name is null then
    raise exception 'Unknown user' using errcode = 'foreign_key_violation';
  end if;
  if new.area_id is not null and not exists (select 1 from public.job_areas a where a.id = new.area_id and a.job_id = new.job_id) then
    raise exception 'Area does not belong to this job' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger variations_before_insert before insert on public.variations
  for each row execute function app.variations_before_insert();

create or replace function app.audit_variations()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_job public.jobs;
  v_user uuid;
begin
  select * into v_job from public.jobs j where j.id = new.job_id;
  perform app.write_activity(new.job_id, 'variation.signed', 'variation', new.id,
    'Variation signed by ' || new.client_name || ' (' || new.client_company || '), raised by ' || new.captured_by_name);
  for v_user in select * from app.office_recipients(new.job_id, false) loop
    perform app.notify(v_user, 'variation.signed', 'Variation signed on ' || v_job.job_number,
      left(new.description, 120) || ' — ' || new.captured_by_name || ', ' || new.captured_by_company, '/office/variations/' || new.id, new.job_id);
  end loop;
  for v_user in select p.id from public.profiles p
                where p.company_id = new.captured_by_company_id and p.active and p.role = 'manager' and p.id <> new.captured_by loop
    perform app.notify(v_user, 'variation.signed', 'Variation signed on ' || v_job.job_number,
      left(new.description, 120) || ' — ' || new.captured_by_name, '/jobs/' || new.job_id || '/variation/' || new.id, new.job_id);
  end loop;
  return null;
end;
$$;
create constraint trigger variations_audit after insert on public.variations
  deferrable initially deferred
  for each row execute function app.audit_variations();

alter table public.variations enable row level security;
alter table public.variation_photos enable row level security;
create policy variations_select on public.variations for select to authenticated
  using (app.can_see_variation(id));
create policy variations_insert on public.variations for insert to authenticated
  with check (captured_by = auth.uid() and app.has_job_access(job_id));
create policy variation_photos_select on public.variation_photos for select to authenticated
  using (app.can_see_variation(variation_id));
create policy variation_photos_insert on public.variation_photos for insert to authenticated
  with check (exists (select 1 from public.variations v where v.id = variation_id and v.captured_by = auth.uid()));
-- Signed variations are a record: no update or delete through the API.
grant select, insert on public.variations, public.variation_photos to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Files
-- ---------------------------------------------------------------------------
create or replace function app.can_read_storage_object(p_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and (
    exists (select 1 from public.document_revisions r
            where r.storage_path = p_name and app.user_can_see_revision(auth.uid(), r.id))
    or exists (select 1 from public.report_photos ph
               where ph.storage_path = p_name and app.user_can_see_report(auth.uid(), ph.report_id))
    or exists (select 1 from public.handovers h
               where (h.signature_path = p_name or h.msw_signature_path = p_name) and app.can_see_handover(h.id))
    or exists (select 1 from public.handover_photos hp where hp.storage_path = p_name and app.can_see_handover(hp.handover_id))
    or exists (select 1 from public.dayworks d
               where (d.client_signature_path = p_name or d.msw_signature_path = p_name) and app.can_see_daywork(d.id))
    or exists (select 1 from public.deliveries v
               where (v.receiver_signature_path = p_name or v.driver_signature_path = p_name) and app.can_see_delivery(v.id))
    or exists (select 1 from public.company_certificates c
               where c.storage_path = p_name and app.can_manage_certificates(c.company_id))
    or exists (select 1 from public.site_visit_photos sp where sp.storage_path = p_name and app.can_do_site_visits())
    or exists (select 1 from public.operative_cards oc where oc.storage_path = p_name and app.can_see_cards(oc.user_id))
    or exists (select 1 from public.variations va
               where (va.client_signature_path = p_name or va.operative_signature_path = p_name) and app.can_see_variation(va.id))
    or exists (select 1 from public.variation_photos vp where vp.storage_path = p_name and app.can_see_variation(vp.variation_id))
  )
$$;

revoke execute on all functions in schema app from public;
grant execute on function
  app.is_api_context(), app.now(), app.current_role(), app.is_staff(), app.is_admin(), app.my_company_id(),
  app.has_job_access(uuid), app.has_area_access(uuid, uuid), app.can_see_document(uuid), app.can_see_revision(uuid),
  app.can_see_report(uuid), app.can_see_report_row(uuid, uuid, uuid, uuid, boolean), app.is_my_assignment(uuid),
  app.minutes_between(time, time), app.can_keep_timesheet(), app.can_see_handover(uuid), app.can_see_daywork(uuid), app.can_see_delivery(uuid),
  app.can_read_storage_object(text), app.is_msw_member(), app.delivery_jobs(), app.can_manage_certificates(uuid), app.can_do_site_visits(),
  app.is_company_boss(), app.is_my_person(uuid), app.can_see_cards(uuid), app.can_manage_cards(uuid), app.can_edit_certificates(uuid),
  app.can_see_variation(uuid)
to authenticated;

revoke execute on function public.email_taken(text), public.my_company_jobs(), public.boss_add_operative(uuid, text, text, text, text),
  public.boss_update_operative(uuid, text, text, text, boolean), public.boss_set_job_access(uuid, uuid, boolean) from public, anon;
grant execute on function public.email_taken(text), public.my_company_jobs(), public.boss_add_operative(uuid, text, text, text, text),
  public.boss_update_operative(uuid, text, text, text, boolean), public.boss_set_job_access(uuid, uuid, boolean) to authenticated;
