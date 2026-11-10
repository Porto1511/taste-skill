-- Every signature has a printed name with it.  MSW's signer is typed on the
-- day (it may not be the person holding the phone); older records fall back
-- to whoever captured them.
alter table public.handovers add column msw_signer_name text
  check (msw_signer_name is null or length(trim(msw_signer_name)) between 2 and 120);
alter table public.dayworks add column msw_signer_name text
  check (msw_signer_name is null or length(trim(msw_signer_name)) between 2 and 120);
update public.handovers set msw_signer_name = captured_by_name where msw_signature_path is not null and msw_signer_name is null;
update public.dayworks set msw_signer_name = captured_by_name where msw_signer_name is null;

-- Timesheets: premium time (e.g. Saturday working).  A flag only — no rates.
alter table public.timesheets add column premium boolean not null default false;
