-- =============================================================================
-- Handovers by trade: nets, deck and studs can be handed over separately
-- (e.g. nets first) or together as a full handover.
-- =============================================================================
alter table public.handovers
  add column scopes text[] not null default '{}'
    check (scopes <@ array['netting', 'deck', 'studs']::text[]);

-- Existing handovers were deck/studs sign-offs.
update public.handovers set scopes = '{deck,studs}' where scopes = '{}';

alter table public.handovers
  add constraint handovers_has_scope check (cardinality(scopes) > 0);
create index handovers_area_idx on public.handovers (job_id, area_id);
