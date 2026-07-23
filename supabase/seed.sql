-- ============================================================================
-- Seed de demonstração. Rodado por `supabase db reset` como superusuário
-- (ignora RLS). Cria uma org demo com dados de exemplo consistentes.
-- Idempotente via IDs fixos + ON CONFLICT.
-- ============================================================================

-- Usuário demo (em produção o usuário vem do Supabase Auth).
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000de',
        'demo@bambucontrol.app',
        '{"full_name":"Usuária Demo"}'::jsonb)
on conflict (id) do nothing;

-- Org demo + membership owner.
insert into public.organizations (id, name, slug, currency, timezone)
values ('00000000-0000-0000-0000-00000000d001', 'Ateliê 3D Demo', 'atelie-3d-demo', 'BRL', 'America/Sao_Paulo')
on conflict (id) do nothing;

insert into public.organization_members (organization_id, user_id, role)
values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000de', 'owner')
on conflict (organization_id, user_id) do nothing;

-- Perfil de custo de máquina (modo calculado).
insert into public.machine_cost_profiles
  (id, organization_id, name, calculation_mode, purchase_price, residual_value,
   useful_life_hours, average_power_w, electricity_price_kwh,
   maintenance_cost_per_hour, overhead_cost_per_hour)
values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d001',
        'X1 Carbon — padrão', 'calculated', 12000, 2000, 10000, 150, 0.95, 0.50, 0.25)
on conflict (id) do nothing;

-- Impressora.
insert into public.printers
  (id, organization_id, name, model, location, machine_cost_profile_id, serial_number)
values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000d001',
        'X1C-Oficina', 'X1 Carbon', 'Bancada 1',
        '00000000-0000-0000-0000-00000000c001', '00M09A1234567')
on conflict (id) do nothing;

-- Filamentos.
insert into public.filaments
  (id, organization_id, brand, name, material, color_name, color_hex, default_price_per_kg)
values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000d001',
   'Bambu Lab', 'PLA Basic Verde', 'PLA', 'Verde', '#00A651', 120.00),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000d001',
   'Bambu Lab', 'PETG HF Preto', 'PETG', 'Preto', '#111111', 160.00)
on conflict (id) do nothing;

-- Rolos.
insert into public.spools
  (organization_id, filament_id, label, purchase_price, initial_net_weight_g, remaining_weight_g, status)
values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000f001',
   'Rolo Verde #1', 120.00, 1000, 820, 'active'),
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000f002',
   'Rolo Preto #1', 160.00, 1000, 940, 'active')
on conflict do nothing;

-- Cliente.
insert into public.customers (id, organization_id, name, whatsapp, email)
values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000d001',
        'Loja do João', '+5511999990000', 'joao@example.com')
on conflict (id) do nothing;

-- Impressão concluída (manual), com material e snapshot de custo.
insert into public.print_jobs
  (id, organization_id, printer_id, title, normalized_status, source,
   provider_start_at, provider_end_at, manual_duration_s, manual_weight_g,
   duration_source, quantity_produced)
values ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000d001',
        '00000000-0000-0000-0000-00000000e001', 'Suporte de fone (x4)', 'completed', 'manual',
        now() - interval '2 hours', now(), 7200, 100, 'manual', 4)
on conflict (id) do nothing;

insert into public.print_job_materials
  (organization_id, print_job_id, filament_id, source, weight_g, price_per_kg_snapshot, material_cost_snapshot)
values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000b001',
        '00000000-0000-0000-0000-00000000f001', 'manual', 100, 120.00, 12.00)
on conflict do nothing;

-- Snapshot de custo (valores coerentes com o motor de custos):
-- material 12.00 + energia (0.15kW*2h*0.95=0.285) + deprec (1/h*2h=2) +
-- manut (0.5*2=1) + overhead (0.25*2=0.5) = 15.785 ~ 15.79
insert into public.print_cost_snapshots
  (organization_id, print_job_id, calculation_version, material_cost, electricity_cost,
   depreciation_cost, maintenance_cost, machine_overhead_cost, total_cost)
values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000b001',
        1, 12.00, 0.2850, 2.00, 1.00, 0.50, 15.7850)
on conflict do nothing;

-- Pedido com item associado à impressão + pagamento parcial.
insert into public.orders
  (id, organization_id, customer_id, order_number, status, ordered_at,
   subtotal, total_charged, total_paid)
values ('00000000-0000-0000-0000-000000009001', '00000000-0000-0000-0000-00000000d001',
        '00000000-0000-0000-0000-00000000a001', 'PED-0001', 'approved', now(),
        80.00, 80.00, 40.00)
on conflict (id) do nothing;

insert into public.order_items
  (id, organization_id, order_id, description, quantity, unit_price, total_price)
values ('00000000-0000-0000-0000-000000008001', '00000000-0000-0000-0000-00000000d001',
        '00000000-0000-0000-0000-000000009001', 'Suporte de fone', 4, 20.00, 80.00)
on conflict (id) do nothing;

insert into public.order_item_print_jobs
  (organization_id, order_item_id, print_job_id, allocated_quantity, allocated_revenue)
values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-000000008001',
        '00000000-0000-0000-0000-00000000b001', 4, 80.00)
on conflict (order_item_id, print_job_id) do nothing;

insert into public.payments (organization_id, order_id, amount, payment_method, paid_at, status)
values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-000000009001',
        40.00, 'pix', now(), 'confirmed')
on conflict do nothing;
