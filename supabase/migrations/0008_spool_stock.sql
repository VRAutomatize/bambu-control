-- ============================================================================
-- 0008 — Estoque de filamento: abate automático do peso do rolo (spool)
-- quando uma impressão registra consumo de material vinculado a esse rolo.
-- Cobre tanto o cadastro manual quanto qualquer sync futuro que grave em
-- print_job_materials com spool_id preenchido.
-- ============================================================================

create or replace function public.apply_spool_consumption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.spool_id is not null then
    update public.spools
    set remaining_weight_g = greatest(remaining_weight_g - new.weight_g, 0),
        status = case
          when greatest(remaining_weight_g - new.weight_g, 0) <= 0 then 'empty'
          when status = 'sealed' then 'active'
          else status
        end
    where id = new.spool_id
      and organization_id = new.organization_id;
  end if;
  return new;
end;
$$;

create trigger trg_print_job_materials_consume_spool
  after insert on public.print_job_materials
  for each row execute function public.apply_spool_consumption();

-- Reverte o consumo se o registro de material for removido (ex.: recálculo
-- que apaga e recria materiais de uma impressão).
create or replace function public.revert_spool_consumption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.spool_id is not null then
    update public.spools
    set remaining_weight_g = least(remaining_weight_g + old.weight_g, initial_net_weight_g),
        status = case when status = 'empty' then 'active' else status end
    where id = old.spool_id
      and organization_id = old.organization_id;
  end if;
  return old;
end;
$$;

create trigger trg_print_job_materials_revert_spool
  after delete on public.print_job_materials
  for each row execute function public.revert_spool_consumption();
