-- 20250425_market_engine.sql
-- RailOS market engine schema.

create extension if not exists "pgcrypto";

-- ──────────────────────────────────────────────────────────────────────────
-- 1. market_state
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists market_state (
  project_id uuid primary key,
  initial_price numeric(18, 2) not null,
  current_price numeric(18, 2) not null,
  total_growth_pct numeric(8, 4) not null default 0,
  monthly_growth_pct numeric(8, 4) not null default 0,
  yearly_growth_pct numeric(8, 4) not null default 0,
  market_phase text not null default 'launch',
  health_status text not null default 'healthy',
  total_deals_count integer not null default 0,
  is_frozen boolean not null default false,
  frozen_reason text,
  last_change_at timestamptz default now(),
  factor_a numeric(10, 4),
  factor_b numeric(10, 4),
  factor_c numeric(10, 4),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_market_state_phase on market_state(market_phase);
create index if not exists idx_market_state_health on market_state(health_status);

-- ──────────────────────────────────────────────────────────────────────────
-- 2. price_history
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists price_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  old_price numeric(18, 2) not null,
  new_price numeric(18, 2) not null,
  change_pct numeric(8, 4) not null,
  recorded_at timestamptz default now(),
  phase text not null,
  trigger text,
  factor_a numeric(10, 4),
  factor_b numeric(10, 4),
  factor_c numeric(10, 4)
);

create index if not exists idx_price_history_project on price_history(project_id, recorded_at desc);

-- ──────────────────────────────────────────────────────────────────────────
-- 3. development_index
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists development_index (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  measured_at timestamptz default now(),
  development_score numeric(8, 4) not null,
  price_to_development_ratio numeric(8, 4) not null,
  intervention_status text not null default 'none',
  raw_a numeric(10, 4),
  raw_b numeric(10, 4),
  raw_c numeric(10, 4),
  raw_d numeric(10, 4),
  raw_e numeric(10, 4),
  committee_rating numeric(8, 4),
  recorded_by uuid
);

create index if not exists idx_development_project on development_index(project_id, measured_at desc);

-- ──────────────────────────────────────────────────────────────────────────
-- 4. stability_fund (single-row balances)
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists stability_fund (
  id integer primary key default 1 check (id = 1),
  total_balance numeric(18, 2) not null default 0,
  available_balance numeric(18, 2) not null default 0,
  reserved_balance numeric(18, 2) not null default 0,
  total_inflow numeric(18, 2) not null default 0,
  total_interventions numeric(18, 2) not null default 0,
  total_profit numeric(18, 2) not null default 0,
  updated_at timestamptz default now()
);

insert into stability_fund (id) values (1) on conflict do nothing;

-- ──────────────────────────────────────────────────────────────────────────
-- 5. fund_transactions
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists fund_transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  amount numeric(18, 2) not null,
  project_id uuid,
  shares_count integer,
  price_per_share numeric(18, 2),
  recorded_at timestamptz default now(),
  notes text,
  created_by uuid
);

create index if not exists idx_fund_tx_recorded on fund_transactions(recorded_at desc);
create index if not exists idx_fund_tx_type on fund_transactions(type);

-- ──────────────────────────────────────────────────────────────────────────
-- 6. development_promises
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists development_promises (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  promise_text text not null,
  promise_type text not null,
  status text not null default 'pending',
  created_at timestamptz default now(),
  due_at timestamptz not null,
  completed_at timestamptz,
  evidence_url text,
  created_by uuid
);

create index if not exists idx_promises_status on development_promises(status);
create index if not exists idx_promises_project on development_promises(project_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 7. deal_qualifications
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists deal_qualifications (
  deal_id uuid primary key,
  category text not null,
  weight numeric(6, 4) not null default 0,
  recorded_at timestamptz default now()
);

create index if not exists idx_qual_category on deal_qualifications(category);

-- ──────────────────────────────────────────────────────────────────────────
-- View: admin_market_overview
-- ──────────────────────────────────────────────────────────────────────────
create or replace view admin_market_overview as
select
  m.project_id,
  m.current_price,
  m.initial_price,
  m.total_growth_pct,
  m.market_phase,
  m.health_status,
  m.total_deals_count,
  m.is_frozen,
  d.development_score,
  d.price_to_development_ratio,
  d.intervention_status
from market_state m
left join lateral (
  select development_score, price_to_development_ratio, intervention_status
  from development_index
  where project_id = m.project_id
  order by measured_at desc
  limit 1
) d on true;

-- ──────────────────────────────────────────────────────────────────────────
-- RPC: apply_fund_delta
-- ──────────────────────────────────────────────────────────────────────────
create or replace function apply_fund_delta(delta numeric)
returns void
language plpgsql
as $$
begin
  update stability_fund
  set
    total_balance = total_balance + delta,
    available_balance = available_balance + delta,
    total_inflow = total_inflow + greatest(delta, 0),
    total_interventions = total_interventions + greatest(-delta, 0),
    updated_at = now()
  where id = 1;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- RLS: enable on all tables (policies set up separately)
-- ──────────────────────────────────────────────────────────────────────────
alter table market_state enable row level security;
alter table price_history enable row level security;
alter table development_index enable row level security;
alter table stability_fund enable row level security;
alter table fund_transactions enable row level security;
alter table development_promises enable row level security;
alter table deal_qualifications enable row level security;
