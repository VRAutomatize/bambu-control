import { describe, expect, it } from 'vitest';
import {
  CALCULATION_VERSION,
  computeCostBreakdown,
  computeProfit,
  depreciationCost,
  energyCost,
  maintenanceCost,
  materialCost,
  overheadCost,
} from './index.js';
import type { CalculatedProfile, DirectHourlyProfile } from './types.js';

const calculatedProfile: CalculatedProfile = {
  calculationMode: 'calculated',
  purchasePrice: 12000,
  residualValue: 2000,
  usefulLifeHours: 10000,
  averagePowerW: 150,
  electricityPriceKwh: 1,
  maintenanceCostPerHour: 0.5,
  overheadCostPerHour: 0.25,
};

const directProfile: DirectHourlyProfile = {
  calculationMode: 'direct_hourly_rate',
  directHourlyCost: 3,
};

describe('materialCost', () => {
  it('calcula custo de um único material: 25g a 120 BRL/kg = 3.00', () => {
    expect(materialCost([{ weightG: 25, pricePerKgSnapshot: 120 }]).toNumber(4)).toBe(3);
  });

  it('soma múltiplos filamentos', () => {
    const cost = materialCost([
      { weightG: 25, pricePerKgSnapshot: 120 }, // 3.00
      { weightG: 10, pricePerKgSnapshot: 200 }, // 2.00
    ]);
    expect(cost.toNumber(4)).toBe(5);
  });

  it('peso zero → custo zero', () => {
    expect(materialCost([{ weightG: 0, pricePerKgSnapshot: 200 }]).toNumber(4)).toBe(0);
  });

  it('lista vazia → custo zero', () => {
    expect(materialCost([]).toNumber(4)).toBe(0);
  });
});

describe('energyCost', () => {
  it('150W por 2h a 1 BRL/kWh = 0.30', () => {
    expect(energyCost(7200, 150, 1).toNumber(4)).toBe(0.3);
  });

  it('duração zero → custo zero', () => {
    expect(energyCost(0, 150, 1).toNumber(4)).toBe(0);
  });
});

describe('depreciationCost', () => {
  it('(12000-2000)/10000 = 1/h; 2h = 2.00', () => {
    expect(depreciationCost(7200, 12000, 2000, 10000).toNumber(4)).toBe(2);
  });

  it('vida útil zero → custo zero (sem divisão por zero)', () => {
    expect(depreciationCost(7200, 12000, 2000, 0).toNumber(4)).toBe(0);
  });
});

describe('maintenance & overhead', () => {
  it('manutenção 0.5/h por 2h = 1.00', () => {
    expect(maintenanceCost(7200, 0.5).toNumber(4)).toBe(1);
  });
  it('overhead 0.25/h por 2h = 0.50', () => {
    expect(overheadCost(7200, 0.25).toNumber(4)).toBe(0.5);
  });
});

describe('computeCostBreakdown — modo calculated', () => {
  it('soma todos os componentes corretamente', () => {
    const b = computeCostBreakdown({
      durationS: 7200,
      materials: [{ weightG: 25, pricePerKgSnapshot: 120 }],
      machineProfile: calculatedProfile,
      laborCost: 5,
      packagingCost: 1,
      otherCost: 0.5,
    });
    expect(b.materialCost).toBe(3);
    expect(b.electricityCost).toBe(0.3);
    expect(b.depreciationCost).toBe(2);
    expect(b.maintenanceCost).toBe(1);
    expect(b.machineOverheadCost).toBe(0.5);
    expect(b.laborCost).toBe(5);
    expect(b.packagingCost).toBe(1);
    expect(b.otherCost).toBe(0.5);
    expect(b.failureAllowanceCost).toBe(0);
    // 3 + 0.3 + 2 + 1 + 0.5 + 5 + 1 + 0.5 = 13.30
    expect(b.totalCost).toBe(13.3);
    expect(b.calculationVersion).toBe(CALCULATION_VERSION);
  });

  it('aplica reserva de falha como percentual sobre o subtotal', () => {
    const b = computeCostBreakdown({
      durationS: 3600,
      materials: [{ weightG: 100, pricePerKgSnapshot: 100 }], // 10.00
      machineProfile: { calculationMode: 'direct_hourly_rate', directHourlyCost: 0 },
      failurePercentage: 10,
    });
    // subtotal = 10.00; reserva = 1.00; total = 11.00
    expect(b.failureAllowanceCost).toBe(1);
    expect(b.totalCost).toBe(11);
  });
});

describe('computeCostBreakdown — modo direct_hourly_rate', () => {
  it('não soma energia/depreciação/manutenção; usa custo direto por hora', () => {
    const b = computeCostBreakdown({
      durationS: 7200, // 2h
      materials: [{ weightG: 25, pricePerKgSnapshot: 120 }], // 3.00
      machineProfile: directProfile, // 3/h * 2h = 6.00 (em machineOverheadCost)
    });
    expect(b.electricityCost).toBe(0);
    expect(b.depreciationCost).toBe(0);
    expect(b.maintenanceCost).toBe(0);
    expect(b.machineOverheadCost).toBe(6);
    expect(b.materialCost).toBe(3);
    expect(b.totalCost).toBe(9); // 3 + 6
  });
});

describe('computeCostBreakdown — quantidade e correção manual', () => {
  it('respeita peso efetivo (correção manual) passado nos materiais', () => {
    // effective_weight_g = manual_weight_g ?? provider_weight_g resolvido antes de chamar
    const b = computeCostBreakdown({
      durationS: 3600,
      materials: [{ weightG: 50, pricePerKgSnapshot: 200 }], // manual sobrepôs
      machineProfile: { calculationMode: 'direct_hourly_rate', directHourlyCost: 0 },
    });
    expect(b.materialCost).toBe(10);
  });

  it('marca o cálculo como estimado quando sinalizado', () => {
    const b = computeCostBreakdown({
      durationS: 3600,
      materials: [{ weightG: 10, pricePerKgSnapshot: 100 }],
      machineProfile: { calculationMode: 'direct_hourly_rate', directHourlyCost: 0 },
      estimated: true,
    });
    expect(b.estimated).toBe(true);
  });
});

describe('computeProfit', () => {
  it('lucro e margem normais', () => {
    const p = computeProfit(100, 60);
    expect(p.grossProfit).toBe(40);
    expect(p.marginPercentage).toBe(40);
  });

  it('receita zero → margem null (nunca infinito)', () => {
    const p = computeProfit(0, 13.3);
    expect(p.grossProfit).toBe(-13.3);
    expect(p.marginPercentage).toBeNull();
  });

  it('impressão falhada: custo sem receita gera prejuízo com margem null', () => {
    const p = computeProfit(0, 8.5);
    expect(p.marginPercentage).toBeNull();
    expect(p.grossProfit).toBe(-8.5);
  });

  it('não usa ponto flutuante: 0.1 + 0.2 em custo é exato', () => {
    // 0.1 + 0.2 clássico do float. Receita 1.00, custo 0.30 → lucro 0.70
    const p = computeProfit(1, computeCostBreakdown({
      durationS: 0,
      materials: [
        { weightG: 1, pricePerKgSnapshot: 100 }, // 0.10
        { weightG: 2, pricePerKgSnapshot: 100 }, // 0.20
      ],
      machineProfile: { calculationMode: 'direct_hourly_rate', directHourlyCost: 0 },
    }).totalCost);
    expect(p.totalCost).toBe(0.3);
    expect(p.grossProfit).toBe(0.7);
  });
});

describe('versionamento', () => {
  it('todo breakdown carrega a versão da fórmula', () => {
    const b = computeCostBreakdown({
      durationS: 0,
      materials: [],
      machineProfile: { calculationMode: 'direct_hourly_rate', directHourlyCost: 0 },
    });
    expect(b.calculationVersion).toBe(CALCULATION_VERSION);
  });
});
