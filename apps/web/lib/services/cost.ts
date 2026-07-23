import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@bambu/db';
import {
  computeCostBreakdown,
  type CostCalculationInput,
  type MachineCostProfile,
  type MaterialInput,
} from '@bambu/domain';

type Client = SupabaseClient<Database>;

/**
 * Recalcula o custo de uma impressão a partir do estado atual e grava um NOVO
 * snapshot imutável (nunca reescreve os anteriores). Retorna o total.
 *
 * Fonte única de cálculo: o mesmo motor usado no dashboard e nos detalhes.
 */
export async function recalculatePrintJob(
  supabase: Client,
  organizationId: string,
  printJobId: string,
  extra?: {
    laborCost?: number;
    packagingCost?: number;
    otherCost?: number;
    failurePercentage?: number;
  },
): Promise<number> {
  const { data: job, error: jobErr } = await supabase
    .from('print_jobs')
    .select('id, printer_id, effective_duration_s')
    .eq('id', printJobId)
    .single();
  if (jobErr || !job) throw new Error('Impressão não encontrada');

  const { data: materials } = await supabase
    .from('print_job_materials')
    .select('weight_g, price_per_kg_snapshot')
    .eq('print_job_id', printJobId);

  const machineProfile = await loadMachineProfile(supabase, job.printer_id);

  const materialInputs: MaterialInput[] = (materials ?? []).map((m) => ({
    weightG: Number(m.weight_g) || 0,
    pricePerKgSnapshot: Number(m.price_per_kg_snapshot) || 0,
  }));

  const input: CostCalculationInput = {
    durationS: Number(job.effective_duration_s) || 0,
    materials: materialInputs,
    machineProfile,
    laborCost: extra?.laborCost ?? 0,
    packagingCost: extra?.packagingCost ?? 0,
    otherCost: extra?.otherCost ?? 0,
    failurePercentage: extra?.failurePercentage ?? 0,
    estimated: materialInputs.length === 0,
  };

  const breakdown = computeCostBreakdown(input);

  const { error: snapErr } = await supabase.from('print_cost_snapshots').insert({
    organization_id: organizationId,
    print_job_id: printJobId,
    calculation_version: breakdown.calculationVersion,
    material_cost: breakdown.materialCost,
    electricity_cost: breakdown.electricityCost,
    depreciation_cost: breakdown.depreciationCost,
    maintenance_cost: breakdown.maintenanceCost,
    machine_overhead_cost: breakdown.machineOverheadCost,
    labor_cost: breakdown.laborCost,
    failure_allowance_cost: breakdown.failureAllowanceCost,
    packaging_cost: breakdown.packagingCost,
    other_cost: breakdown.otherCost,
    total_cost: breakdown.totalCost,
    estimated: breakdown.estimated,
    calculation_input_json: input as unknown as Record<string, unknown>,
  });
  if (snapErr) throw new Error(`Falha ao gravar snapshot: ${snapErr.message}`);

  return breakdown.totalCost;
}

/** Carrega o perfil de custo da impressora; usa um fallback seguro se ausente. */
async function loadMachineProfile(
  supabase: Client,
  printerId: string | null,
): Promise<MachineCostProfile> {
  if (printerId) {
    const { data: printer } = await supabase
      .from('printers')
      .select('machine_cost_profile_id')
      .eq('id', printerId)
      .single();

    if (printer?.machine_cost_profile_id) {
      const { data: profile } = await supabase
        .from('machine_cost_profiles')
        .select('*')
        .eq('id', printer.machine_cost_profile_id)
        .single();

      if (profile) {
        if (profile.calculation_mode === 'direct_hourly_rate') {
          return {
            calculationMode: 'direct_hourly_rate',
            directHourlyCost: Number(profile.direct_hourly_cost) || 0,
          };
        }
        return {
          calculationMode: 'calculated',
          purchasePrice: Number(profile.purchase_price) || 0,
          residualValue: Number(profile.residual_value) || 0,
          usefulLifeHours: Number(profile.useful_life_hours) || 0,
          averagePowerW: Number(profile.average_power_w) || 0,
          electricityPriceKwh: Number(profile.electricity_price_kwh) || 0,
          maintenanceCostPerHour: Number(profile.maintenance_cost_per_hour) || 0,
          overheadCostPerHour: Number(profile.overhead_cost_per_hour) || 0,
        };
      }
    }
  }
  // Fallback: sem perfil, custo de máquina zero (só material entra).
  return { calculationMode: 'direct_hourly_rate', directHourlyCost: 0 };
}
