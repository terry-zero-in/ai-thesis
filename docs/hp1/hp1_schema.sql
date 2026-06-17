-- HP-1 standalone Supabase schema — full migration (2026-06-16)
-- Run once in the new project's SQL editor. Idempotent-ish: uses IF NOT EXISTS where safe.
-- Server jobs (engine GitHub Action, Fable edge function) write via the SERVICE_ROLE key,
-- which bypasses RLS. The Next.js app reads via the anon/authenticated key under the
-- RLS policies at the bottom. Two humans: owner (terry, write) + viewer (mom, read-only).

create schema if not exists hp1;

-- ---------------------------------------------------------------------------
-- AUTH / ROLE MAPPING
-- ---------------------------------------------------------------------------
create table if not exists hp1.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text unique not null,
  role          text not null check (role in ('owner','viewer')),
  account_label text check (account_label in ('terry','mom')),
  created_at    timestamptz not null default now()
);

create or replace function hp1.is_owner() returns boolean
  language sql security definer stable set search_path = hp1, public as $$
  select exists (select 1 from hp1.profiles p where p.id = auth.uid() and p.role = 'owner');
$$;

-- ---------------------------------------------------------------------------
-- MARKET DATA (HP-1 owns its own ingestion now — no shared v2 project)
-- ---------------------------------------------------------------------------
create table if not exists hp1.prices (
  ticker text not null,
  d      date not null,
  close  numeric not null,        -- dividend/split-adjusted close
  primary key (ticker, d)
);
create index if not exists prices_d_idx on hp1.prices (d);

create table if not exists hp1.macro_gauges (
  d           date primary key,
  naaim       numeric,            -- NAAIM exposure
  aaii_spread numeric,            -- AAII bull-bear 3wk spread
  fear_greed  numeric             -- CNN Fear & Greed
);

-- ---------------------------------------------------------------------------
-- ENGINE OUTPUT (written by the post-close GitHub Action)
-- ---------------------------------------------------------------------------
create table if not exists hp1.engine_runs (
  run_id         uuid primary key default gen_random_uuid(),
  as_of          date not null,
  data_through   date not null,
  breadth_pct    numeric(5,2),
  gate_gross     numeric(4,3),    -- 1.000 / 0.500 / 0.250
  regime_read    text,
  universe_n     int,
  engine_version text not null,
  created_at     timestamptz not null default now(),
  unique (as_of, engine_version)
);

create table if not exists hp1.engine_ranks (
  id              bigint generated always as identity primary key,
  run_id          uuid not null references hp1.engine_runs(run_id) on delete cascade,
  ticker          text not null,
  layer           text,
  view            text not null check (view in ('combined','pureplay','megacap')),
  score           numeric,
  pct             numeric(5,2),
  z_m numeric, z_ram numeric, z_dd numeric,
  driver_tag      text,           -- return-driven|stability-driven|balanced|broken-trend
  above_100 boolean, above_200 boolean,
  dist_100_pct numeric, dist_200_pct numeric,
  dd_from_high numeric,
  sleeve_eligible boolean,
  r3 numeric, r6 numeric, r12 numeric,
  unique (run_id, ticker, view)
);
create index if not exists ranks_ticker_idx on hp1.engine_ranks (ticker);
create index if not exists ranks_run_view_idx on hp1.engine_ranks (run_id, view, pct desc);

-- ---------------------------------------------------------------------------
-- FABLE LAYER (written by the Fable edge function)
-- ---------------------------------------------------------------------------
create table if not exists hp1.fable_runs (
  run_id          uuid primary key default gen_random_uuid(),
  engine_run_id   uuid references hp1.engine_runs(run_id) on delete set null,
  trigger_type    text not null,  -- scheduled|hard_exit|name_drop|circuit_breaker|spy_drop|vix_streak|anth_news
  model           text not null,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  status          text not null check (status in ('ok','failed','partial')),
  raw_json        jsonb,
  portfolio_block jsonb,
  decisions       jsonb,
  cash_note       text
);

create table if not exists hp1.fable_reviews (
  id           bigint generated always as identity primary key,
  run_id       uuid not null references hp1.fable_runs(run_id) on delete cascade,
  ticker       text not null,
  verdict      text not null check (verdict in ('CONFIRM','FLAG','DOWNGRADE','UPGRADE','VETO')),
  adjustment   int not null default 0 check (adjustment between -10 and 5),  -- D6 bound
  adjusted_pct numeric(5,2),
  action       text check (action in ('none','block_entry','accelerate_exit')),  -- D5 role
  action_reason text,
  flags        text[],
  confidence   text,
  evidence     jsonb,             -- [{claim,source,date,url,validated}]  validated set by D6 check
  next_event   jsonb,
  reviewed_at  timestamptz not null default now(),
  unique (run_id, ticker)
);
create index if not exists reviews_ticker_idx on hp1.fable_reviews (ticker);

-- ---------------------------------------------------------------------------
-- PORTFOLIO (the only write path for positions is hp1.trades)
-- ---------------------------------------------------------------------------
create table if not exists hp1.tranches (
  id                 uuid primary key default gen_random_uuid(),
  label              text not null,
  account_label      text not null check (account_label in ('terry','mom')),
  amount             numeric not null,
  planned_date       date,
  released_at        timestamptz,
  breadth_at_release numeric(5,2),
  status             text not null default 'pending' check (status in ('pending','released','gated','skipped'))
);

create table if not exists hp1.trades (
  id            uuid primary key default gen_random_uuid(),
  ticker        text not null,
  side          text not null check (side in ('buy','sell')),
  qty           numeric not null check (qty > 0),
  price         numeric not null check (price >= 0),
  fee           numeric not null default 0,
  executed_at   timestamptz not null,
  sleeve        text not null check (sleeve in ('tactical','core','anth')),
  account_label text not null check (account_label in ('terry','mom')),
  tranche_id    uuid references hp1.tranches(id) on delete set null,
  note          text,
  entered_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);
create index if not exists trades_ticker_idx on hp1.trades (ticker, executed_at);
create index if not exists trades_account_idx on hp1.trades (account_label);

-- Current holdings (avg-cost). Full FIFO tax-lot + position-high tracking lives in app code.
create or replace view hp1.positions as
with agg as (
  select account_label, ticker, sleeve,
         sum(case when side='buy' then qty else -qty end)            as net_qty,
         sum(case when side='buy' then qty*price + fee else 0 end)   as buy_cost,
         sum(case when side='buy' then qty else 0 end)               as buy_qty,
         min(executed_at) filter (where side='buy')                  as entry_date
  from hp1.trades
  group by account_label, ticker, sleeve
)
select account_label, ticker, sleeve, net_qty,
       case when buy_qty > 0 then buy_cost / buy_qty else 0 end as avg_cost,
       entry_date
from agg
where net_qty <> 0;

-- ---------------------------------------------------------------------------
-- ANTH MODULE (single row; ceiling immutable by Fable per D8)
-- ---------------------------------------------------------------------------
create table if not exists hp1.anth_state (
  id                  int primary key default 1 check (id = 1),
  ceiling_multiple    numeric,
  ceiling_set_at      timestamptz,
  verified_run_rate   numeric,    -- USD billions
  run_rate_source     text,
  run_rate_date       date,
  run_rate_verified   boolean default false,
  independent_check_at timestamptz,
  status              text check (status in ('GO','WAIT','STOP')),
  history             jsonb default '[]'::jsonb
);

-- ---------------------------------------------------------------------------
-- DECISIONS LOG + RECORD + AIQ
-- ---------------------------------------------------------------------------
create table if not exists hp1.decisions_log (
  id           uuid primary key default gen_random_uuid(),
  fable_run_id uuid references hp1.fable_runs(run_id) on delete cascade,
  priority     int,
  text         text not null,
  kind         text,
  acked_at     timestamptz,
  acked_by     uuid references auth.users(id),
  outcome_note text,
  created_at   timestamptz not null default now()
);

create table if not exists hp1.backtest_record (
  id             bigint generated always as identity primary key,
  variant        text not null,
  window         text not null,  -- '24m' | '36m'
  cagr numeric, vol numeric, sharpe numeric, sortino numeric,
  maxdd numeric, worst_day numeric, total numeric,
  engine_version text not null,
  is_canonical   boolean not null default true,
  loaded_at      timestamptz not null default now(),
  unique (variant, window, engine_version)
);

create table if not exists hp1.aiq_scores (
  id        bigint generated always as identity primary key,
  ticker    text not null unique,
  layer     text,
  total int, disc int, defens int, conc int, capex int, indep int, acct int,
  scored_on date,
  status    text not null default 'draft' check (status in ('seed','draft','ratified')),
  notes     jsonb
);

-- Fable calibration starter (forward-return separation is computed in app/SQL once
-- prices + reviews have accumulated; this view is the verdict-distribution scaffold).
create or replace view hp1.fable_calibration as
select verdict, count(*) as n, avg(adjustment) as avg_adj
from hp1.fable_reviews
group by verdict;

-- ---------------------------------------------------------------------------
-- SEEDS
-- ---------------------------------------------------------------------------
insert into hp1.anth_state (id, ceiling_multiple, ceiling_set_at, verified_run_rate,
                            run_rate_source, run_rate_date, run_rate_verified, status)
values (1, 15, now(), 47, 'Anthropic Series H announcement', '2026-05-28', true, 'WAIT')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Pattern: authenticated users (owner+viewer) can SELECT everything.
-- Only owner can write the human-editable tables. Engine/Fable tables get no
-- write policy because only the service_role (which bypasses RLS) writes them.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','prices','macro_gauges','engine_runs','engine_ranks',
    'fable_runs','fable_reviews','tranches','trades','anth_state',
    'decisions_log','backtest_record','aiq_scores'
  ] loop
    execute format('alter table hp1.%I enable row level security;', t);
    execute format($f$create policy %1$s_sel on hp1.%1$s for select to authenticated using (true);$f$, t);
  end loop;
end $$;

-- Owner-only writes on the human-editable tables
do $$
declare t text;
begin
  foreach t in array array['trades','tranches','anth_state','decisions_log','aiq_scores','profiles'] loop
    execute format($f$create policy %1$s_ins on hp1.%1$s for insert to authenticated with check (hp1.is_owner());$f$, t);
    execute format($f$create policy %1$s_upd on hp1.%1$s for update to authenticated using (hp1.is_owner()) with check (hp1.is_owner());$f$, t);
    execute format($f$create policy %1$s_del on hp1.%1$s for delete to authenticated using (hp1.is_owner());$f$, t);
  end loop;
end $$;

-- Expose hp1 schema to PostgREST (Supabase): also add "hp1" under
-- Project Settings → API → Exposed schemas in the dashboard.
grant usage on schema hp1 to anon, authenticated, service_role;
grant select on all tables in schema hp1 to anon, authenticated;
grant all on all tables in schema hp1 to service_role;
alter default privileges in schema hp1 grant select on tables to authenticated;
alter default privileges in schema hp1 grant all on tables to service_role;

-- ---------------------------------------------------------------------------
-- POST-SIGNUP (run after Terry and mom have signed up via Supabase Auth):
-- insert into hp1.profiles (id, email, role, account_label) values
--   ('<terry-auth-uid>', 'terry@zero-in.io', 'owner',  'terry'),
--   ('<mom-auth-uid>',   '<mom-email>',      'viewer', 'mom');
-- ---------------------------------------------------------------------------
