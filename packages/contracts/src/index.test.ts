import { describe, expect, it } from 'vitest';
import {
  createOrganizationSchema,
  machineCostProfileSchema,
  manualPrintJobSchema,
  paymentSchema,
} from './index.js';

describe('createOrganizationSchema', () => {
  it('aceita slug válido e aplica defaults', () => {
    const r = createOrganizationSchema.parse({ name: 'Ateliê', slug: 'atelie-3d' });
    expect(r.currency).toBe('BRL');
    expect(r.timezone).toBe('America/Sao_Paulo');
  });
  it('rejeita slug com maiúsculas/espaços', () => {
    expect(createOrganizationSchema.safeParse({ name: 'X', slug: 'Com Espaço' }).success).toBe(
      false,
    );
  });
});

describe('machineCostProfileSchema', () => {
  it('rejeita valor residual maior que preço de compra no modo calculado', () => {
    const r = machineCostProfileSchema.safeParse({
      name: 'X1',
      calculationMode: 'calculated',
      purchasePrice: 1000,
      residualValue: 2000,
    });
    expect(r.success).toBe(false);
  });
  it('permite residual > compra irrelevante no modo direto', () => {
    const r = machineCostProfileSchema.safeParse({
      name: 'X1',
      calculationMode: 'direct_hourly_rate',
      directHourlyCost: 3,
    });
    expect(r.success).toBe(true);
  });
});

describe('manualPrintJobSchema', () => {
  it('coage strings numéricas (form data) e aplica defaults', () => {
    const r = manualPrintJobSchema.parse({
      title: 'Peça',
      manualWeightG: '25.5',
      quantityProduced: '4',
    });
    expect(r.manualWeightG).toBe(25.5);
    expect(r.quantityProduced).toBe(4);
    expect(r.normalizedStatus).toBe('completed');
    expect(r.materials).toEqual([]);
  });
});

describe('paymentSchema', () => {
  it('exige valor positivo', () => {
    expect(paymentSchema.safeParse({ amount: 0 }).success).toBe(false);
    expect(paymentSchema.safeParse({ amount: 10 }).success).toBe(true);
  });
});
