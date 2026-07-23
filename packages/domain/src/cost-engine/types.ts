/**
 * Tipos do motor de custos. Todos os valores monetários e físicos entram como
 * `number` (vindos do banco/JSON) e são convertidos para Dec internamente.
 * As saídas monetárias são arredondadas para 4 casas (numeric(14,4) no banco).
 */

/** Modo de cálculo do perfil de custo da máquina. */
export type MachineCalculationMode = 'direct_hourly_rate' | 'calculated';

/** Estratégia de reserva para falhas. */
export type FailureStrategy = 'percentual_sobre_custo' | 'percentual_historico';

/** Um material consumido por uma impressão (linha de print_job_materials). */
export interface MaterialInput {
  /** Peso efetivo em gramas usado para o cálculo. */
  weightG: number;
  /** Preço por kg registrado no snapshot (BRL/kg). */
  pricePerKgSnapshot: number;
}

/** Perfil de custo da máquina no modo `direct_hourly_rate`. */
export interface DirectHourlyProfile {
  calculationMode: 'direct_hourly_rate';
  /** Custo direto por hora de máquina (BRL/h). */
  directHourlyCost: number;
}

/** Perfil de custo da máquina no modo `calculated`. */
export interface CalculatedProfile {
  calculationMode: 'calculated';
  /** Preço de compra da impressora (BRL). */
  purchasePrice: number;
  /** Valor residual estimado (BRL). */
  residualValue: number;
  /** Vida útil em horas. */
  usefulLifeHours: number;
  /** Potência média (W). */
  averagePowerW: number;
  /** Preço da energia (BRL/kWh). */
  electricityPriceKwh: number;
  /** Custo de manutenção por hora (BRL/h). */
  maintenanceCostPerHour: number;
  /** Overhead da máquina por hora (BRL/h). */
  overheadCostPerHour: number;
}

export type MachineCostProfile = DirectHourlyProfile | CalculatedProfile;

/** Entrada completa para o cálculo de custo de uma impressão. */
export interface CostCalculationInput {
  /** Duração efetiva em segundos. */
  durationS: number;
  /** Materiais consumidos. */
  materials: MaterialInput[];
  /** Perfil de custo da máquina. */
  machineProfile: MachineCostProfile;
  /** Mão de obra (BRL). */
  laborCost?: number;
  /** Embalagem (BRL). */
  packagingCost?: number;
  /** Outros custos (BRL). */
  otherCost?: number;
  /**
   * Reserva para falhas: percentual (0–100) aplicado sobre o subtotal de
   * produção (tudo exceto a própria reserva). MVP: percentual_sobre_custo.
   */
  failurePercentage?: number;
  /**
   * Marca o cálculo como estimado (ex.: distribuição de material sem peso real
   * por material). Não altera o valor, apenas sinaliza.
   */
  estimated?: boolean;
}

/** Detalhamento do custo calculado — vira um print_cost_snapshot imutável. */
export interface CostBreakdown {
  materialCost: number;
  electricityCost: number;
  depreciationCost: number;
  maintenanceCost: number;
  machineOverheadCost: number;
  laborCost: number;
  failureAllowanceCost: number;
  packagingCost: number;
  otherCost: number;
  totalCost: number;
  /** Versão da fórmula usada. Nunca reescreve snapshots antigos. */
  calculationVersion: number;
  /** True se algum input foi estimado. */
  estimated: boolean;
}

/** Resultado de receita/lucro/margem. */
export interface ProfitResult {
  /** Receita bruta reconhecida/atribuída (BRL). */
  grossRevenue: number;
  /** Custo total (BRL). */
  totalCost: number;
  /** Lucro bruto = receita - custo. */
  grossProfit: number;
  /**
   * Margem percentual = lucro / receita * 100.
   * `null` quando a receita é zero (nunca infinito).
   */
  marginPercentage: number | null;
}
