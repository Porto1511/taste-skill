-- =============================================================================
-- Timesheets, simplified: per job the operative records only
--   set off -> arrived on site -> left site -> got back (if going home).
-- Time on site is worked out (arrived -> left site); no breaks.
-- Always travelling: driver or passenger (passengers say who drove).
-- Work done: netting, deck, studs, delivery or other.
--
-- Column mapping: travel_out_start = set off, travel_out_end = arrived,
-- travel_back_start = left site, travel_back_end = got back.
-- site_start / site_finish / break_minutes are kept only for older entries.
-- =============================================================================

alter table public.timesheets drop constraint if exists timesheets_pairs;
alter table public.timesheets drop constraint if exists timesheets_something;
alter table public.timesheets drop constraint if exists timesheets_work_done_check;

-- Older entries: "left site" is the old site finish; "arrived" the old start.
update public.timesheets set travel_back_start = site_finish
  where travel_back_start is null and site_finish is not null;
update public.timesheets set travel_out_end = site_start
  where travel_out_end is null and site_start is not null;

-- New rules apply to new and edited entries (NOT VALID: older rows kept as recorded).
alter table public.timesheets
  add constraint timesheets_times check (
    travel_out_start is not null and travel_out_end is not null and travel_back_start is not null
    and (travel_back_end is null or travel_back_start is not null)
  ) not valid,
  add constraint timesheets_travel_mode check (travel_mode in ('driver', 'passenger')) not valid,
  add constraint timesheets_work_types check (
    work_done <@ array['netting', 'deck', 'studs', 'delivery', 'other']::text[]
  ) not valid;

alter table public.timesheets
  add column driven_by text check (driven_by is null or length(driven_by) <= 120);

-- Time on site = arrived -> left site.
alter table public.timesheets drop column site_minutes;
alter table public.timesheets add column site_minutes integer generated always as (
  app.minutes_between(travel_out_end, travel_back_start)
) stored;
