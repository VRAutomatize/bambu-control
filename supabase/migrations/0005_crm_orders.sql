-- ============================================================================
-- 0005 — Clientes, pedidos, itens, associação N:N impressão↔item e pagamentos.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- customers — dados sensíveis opcionais
-- ---------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  document text,
  email text,
  phone text,
  whatsapp text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_customers_org on public.customers (organization_id);
create index idx_customers_active on public.customers (organization_id, active);
create trigger trg_customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
select public.apply_standard_org_rls('customers');

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  order_number text not null,
  status text not null default 'draft'
    check (status in ('draft','quoted','approved','in_production','ready','delivered','cancelled')),
  ordered_at timestamptz,
  due_at timestamptz,
  completed_at timestamptz,
  notes text,
  subtotal numeric(14, 4) not null default 0,
  discount numeric(14, 4) not null default 0,
  shipping_amount numeric(14, 4) not null default 0,
  total_charged numeric(14, 4) not null default 0,
  total_paid numeric(14, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, order_number)
);
create index idx_orders_org on public.orders (organization_id);
create index idx_orders_customer on public.orders (organization_id, customer_id);
create index idx_orders_status on public.orders (organization_id, status);
create trigger trg_orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
select public.apply_standard_org_rls('orders');

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  description text not null,
  quantity numeric(14, 3) not null default 1,
  unit_price numeric(14, 4) not null default 0,
  total_price numeric(14, 4) not null default 0,
  labor_cost numeric(14, 4) not null default 0,
  packaging_cost numeric(14, 4) not null default 0,
  other_cost numeric(14, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_oi_org on public.order_items (organization_id);
create index idx_oi_order on public.order_items (order_id);
create trigger trg_oi_updated_at before update on public.order_items
  for each row execute function public.set_updated_at();
select public.apply_standard_org_rls('order_items');

-- ---------------------------------------------------------------------------
-- order_item_print_jobs — N:N entre itens e impressões
-- Uma impressão pode produzir várias unidades / atender mais de um item.
-- ---------------------------------------------------------------------------
create table public.order_item_print_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  print_job_id uuid not null references public.print_jobs (id) on delete cascade,
  allocated_quantity numeric(14, 3) not null default 1,
  allocated_revenue numeric(14, 4) not null default 0,
  created_at timestamptz not null default now(),
  unique (order_item_id, print_job_id)
);
create index idx_oipj_org on public.order_item_print_jobs (organization_id);
create index idx_oipj_item on public.order_item_print_jobs (order_item_id);
create index idx_oipj_job on public.order_item_print_jobs (print_job_id);
select public.apply_standard_org_rls('order_item_print_jobs');

-- ---------------------------------------------------------------------------
-- payments — pagamentos parciais suportados
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  amount numeric(14, 4) not null,
  payment_method text,
  paid_at timestamptz,
  status text not null default 'confirmed'
    check (status in ('pending','confirmed','refunded','cancelled')),
  notes text,
  created_at timestamptz not null default now()
);
create index idx_payments_org on public.payments (organization_id);
create index idx_payments_order on public.payments (order_id);
select public.apply_standard_org_rls('payments');
