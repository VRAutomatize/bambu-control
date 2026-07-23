/**
 * Motor de custos — camada de domínio PURA e testável. Sem I/O, sem side effects.
 * Todas as funções são determinísticas e usam Dec (BigInt) internamente.
 *
 * O dashboard e as telas de detalhe DEVEM usar estas mesmas funções — nenhum KPID
 * deve duplicar fórmulas no front-end.
 */

import { Dec, dec } from '../money.js';
import type {
  CostBreakdown,
  CostCalculationInput,
  MachineCostProfile,
  MaterialInput,
  ProfitResult,
} from './types.js';

export * from './types.js';

/**
 * Versão atual da fórmula de cálculo. Incrementar quando as regras mudarem.
 * Snapshots antigos guardam sua própria versão e NÃO são reescritos.
 */
export const CALCULATION_VERSION = 1;

const SECONDS_PER_HOUR = 3600;
const GRAMS_PER_KG = 1000;
const WATTS_PER_KW = 1000;

/** Converte segundos em horas (Dec). */
export function durationHours(durationS: number): Dec {
  return dec(durationS).div(SECONDS_PER_HOUR);
}

/**
 * Custo de material: soma(peso_g * preço_por_kg / 1000).
 * Suporta múltiplos materiais.
 */
export function materialCost(materials: MaterialInput[]): Dec {
  return materials.reduce((acc, m) => {
    const pricePerGram = dec(m.pricePerKgSnapshot).div(GRAMS_PER_KG);
    return acc.add(dec(m.weightG).mul(pricePerGram));
  }, Dec.ZERO);
}

/**
 * Custo de energia: (potência_w / 1000) * duração_h * preço_kwh.
 */
export function energyCost(
  durationS: number,
  averagePowerW: number,
  electricityPriceKwh: number,
): Dec {
  const energyKwh = dec(averagePowerW).div(WATTS_PER_KW).mul(durationHours(durationS));
  return energyKwh.mul(electricityPriceKwh);
}

/**
 * Custo de depreciação: ((compra - residual) / vida_útil_horas) * duração_h.
 * Retorna zero quando a vida útil é <= 0 (evita divisão por zero).
 */
export function depreciationCost(
  durationS: number,
  purchasePrice: number,
  residualValue: number,
  usefulLifeHours: number,
): Dec {
  if (usefulLifeHours <= 0) return Dec.ZERO;
  const depreciableBase = dec(purchasePrice).sub(residualValue);
  const perHour = depreciableBase.div(usefulLifeHours);
  return perHour.mul(durationHours(durationS));
}

/** Custo de manutenção: manutenção_por_hora * duração_h. */
export function maintenanceCost(durationS: number, maintenanceCostPerHour: number): Dec {
  return dec(maintenanceCostPerHour).mul(durationHours(durationS));
}

/** Custo de overhead da máquina: overhead_por_hora * duração_h. */
export function overheadCost(durationS: number, overheadCostPerHour: number): Dec {
  return dec(overheadCostPerHour).mul(durationHours(durationS));
}

/** Custo direto por hora: custo_hora_direto * duração_h. */
export function directHourlyCost(durationS: number, directHourlyCostPerHour: number): Dec {
  return dec(directHourlyCostPerHour).mul(durationHours(durationS));
}

/**
 * Componentes de custo da máquina, respeitando o modo do perfil.
 * - `direct_hourly_rate`: apenas custo direto por hora. NÃO soma energia,
 *   depreciação e manutenção novamente.
 * - `calculated`: energia + depreciação + manutenção + overhead.
 */
function machineComponents(durationS: number, profile: MachineCostProfile) {
  if (profile.calculationMode === 'direct_hourly_rate') {
    return {
      electricityCost: Dec.ZERO,
      depreciationCost: Dec.ZERO,
      maintenanceCost: Dec.ZERO,
      // O custo direto por hora é modelado como overhead da máquina no breakdown.
      machineOverheadCost: directHourlyCost(durationS, profile.directHourlyCost),
    };
  }
  return {
    electricityCost: energyCost(durationS, profile.averagePowerW, profile.electricityPriceKwh),
    depreciationCost: depreciationCost(
      durationS,
      profile.purchasePrice,
      profile.residualValue,
      profile.usefulLifeHours,
    ),
    maintenanceCost: maintenanceCost(durationS, profile.maintenanceCostPerHour),
    machineOverheadCost: overheadCost(durationS, profile.overheadCostPerHour),
  };
}

/**
 * Cálculo completo do custo de uma impressão. Retorna um breakdown pronto para
 * virar um print_cost_snapshot imutável.
 *
 * A reserva de falha (MVP) é aplicada como percentual sobre o subtotal de
 * produção (tudo exceto a própria reserva).
 */
export function computeCostBreakdown(input: CostCalculationInput): CostBreakdown {
  const { durationS, materials, machineProfile } = input;
  const labor = dec(input.laborCost ?? 0);
  const packaging = dec(input.packagingCost ?? 0);
  const other = dec(input.otherCost ?? 0);

  const material = materialCost(materials);
  const machine = machineComponents(durationS, machineProfile);

  const productionSubtotal = material
    .add(machine.electricityCost)
    .add(machine.depreciationCost)
    .add(machine.maintenanceCost)
    .add(machine.machineOverheadCost)
    .add(labor)
    .add(packaging)
    .add(other);

  const failurePct = input.failurePercentage ?? 0;
  const failureAllowance =
    failurePct > 0 ? productionSubtotal.mul(dec(failurePct).div(100)) : Dec.ZERO;

  const total = productionSubtotal.add(failureAllowance);

  return {
    materialCost: material.toNumber(4),
    electricityCost: machine.electricityCost.toNumber(4),
    depreciationCost: machine.depreciationCost.toNumber(4),
    maintenanceCost: machine.maintenanceCost.toNumber(4),
    machineOverheadCost: machine.machineOverheadCost.toNumber(4),
    laborCost: labor.toNumber(4),
    failureAllowanceCost: failureAllowance.toNumber(4),
    packagingCost: packaging.toNumber(4),
    otherCost: other.toNumber(4),
    totalCost: total.toNumber(4),
    calculationVersion: CALCULATION_VERSION,
    estimated: input.estimated ?? false,
  };
}

/**
 * Receita, lucro e margem.
 * - Margem com receita zero → `null` (nunca infinito).
 */
export function computeProfit(grossRevenue: number, totalCost: number): ProfitResult {
  const revenue = dec(grossRevenue);
  const cost = dec(totalCost);
  const profit = revenue.sub(cost);

  const marginPercentage = revenue.isZero()
    ? null
    : profit.div(revenue).mul(100).toNumber(2);

  return {
    grossRevenue: revenue.toNumber(4),
    totalCost: cost.toNumber(4),
    grossProfit: profit.toNumber(4),
    marginPercentage,
  };
}
