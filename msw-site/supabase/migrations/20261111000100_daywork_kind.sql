-- Daywork sheets say whether they are standing time or extra work, so the
-- QS can total each against subcontractor invoices.  Quantities only.
alter table public.dayworks
  add column kind text not null default 'extra' check (kind in ('extra', 'standing'));

-- Existing sheets: anything described as standing time is standing time.
update public.dayworks set kind = 'standing' where description ilike '%standing time%';

create index dayworks_week_idx on public.dayworks (week_commencing);
create index deliveries_signed_idx on public.deliveries (signed_at);
