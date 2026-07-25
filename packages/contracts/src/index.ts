import { z } from 'zod';

/**
 * Contratos compartilhados (Zod) entre front-end e API server-side.
 * Validam payloads antes de qualquer escrita. Erros padronizados via ApiError.
 */

// ---------------------------------------------------------------------------
// Comuns
// ---------------------------------------------------------------------------
export const orgRoleSchema = z.enum(['owner', 'admin', 'operator', 'viewer']);
export type OrgRole = z.infer<typeof orgRoleSchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type Pagination = z.infer<typeof paginationSchema>;

export const uuid = z.string().uuid();

/** Erro de API padronizado (sem vazar detalhes internos). */
export interface ApiError {
  error: {
    code: string;
    message: string;
    /** Detalhes de validação de campo, seguros para exibir. */
    fields?: Record<string, string>;
  };
}

// ---------------------------------------------------------------------------
// Organização
// ---------------------------------------------------------------------------
export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Use apenas letras minúsculas, números e hífen'),
  currency: z.string().length(3).default('BRL'),
  timezone: z.string().min(3).default('America/Sao_Paulo'),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

// ---------------------------------------------------------------------------
// Filamentos
// ---------------------------------------------------------------------------
export const filamentSchema = z.object({
  brand: z.string().max(120).optional().nullable(),
  name: z.string().min(1).max(160),
  material: z.string().max(60).optional().nullable(),
  colorName: z.string().max(60).optional().nullable(),
  colorHex: z
    .string()
    .regex(/^#?[0-9a-fA-F]{6}$/, 'Cor hex inválida')
    .optional()
    .nullable(),
  diameterMm: z.coerce.number().positive().default(1.75),
  defaultPricePerKg: z.coerce.number().min(0).default(0),
  density: z.coerce.number().positive().optional().nullable(),
  active: z.boolean().default(true),
});
export type FilamentInput = z.infer<typeof filamentSchema>;

// ---------------------------------------------------------------------------
// Rolos (spools) — estoque físico de filamento
// ---------------------------------------------------------------------------
export const spoolSchema = z.object({
  filamentId: uuid,
  label: z.string().max(120).optional().nullable(),
  supplier: z.string().max(120).optional().nullable(),
  purchasePrice: z.coerce.number().min(0).default(0),
  initialNetWeightG: z.coerce.number().positive().default(1000),
  lotNumber: z.string().max(80).optional().nullable(),
});
export type SpoolInput = z.infer<typeof spoolSchema>;

// ---------------------------------------------------------------------------
// Perfil de custo de máquina
// ---------------------------------------------------------------------------
export const machineCostProfileSchema = z
  .object({
    name: z.string().min(1).max(120),
    calculationMode: z.enum(['direct_hourly_rate', 'calculated']),
    directHourlyCost: z.coerce.number().min(0).default(0),
    purchasePrice: z.coerce.number().min(0).default(0),
    residualValue: z.coerce.number().min(0).default(0),
    usefulLifeHours: z.coerce.number().min(0).default(0),
    averagePowerW: z.coerce.number().min(0).default(0),
    electricityPriceKwh: z.coerce.number().min(0).default(0),
    maintenanceCostPerHour: z.coerce.number().min(0).default(0),
    overheadCostPerHour: z.coerce.number().min(0).default(0),
  })
  .refine((v) => v.residualValue <= v.purchasePrice || v.calculationMode === 'direct_hourly_rate', {
    message: 'Valor residual não pode ser maior que o preço de compra',
    path: ['residualValue'],
  });
export type MachineCostProfileInput = z.infer<typeof machineCostProfileSchema>;

// ---------------------------------------------------------------------------
// Impressão manual
// ---------------------------------------------------------------------------
export const normalizedStatusSchema = z.enum([
  'pending',
  'printing',
  'completed',
  'failed',
  'cancelled',
  'unknown',
]);

export const manualPrintJobSchema = z.object({
  title: z.string().min(1).max(200),
  printerId: uuid.optional().nullable(),
  normalizedStatus: normalizedStatusSchema.default('completed'),
  manualDurationS: z.coerce.number().min(0).optional().nullable(),
  manualWeightG: z.coerce.number().min(0).optional().nullable(),
  quantityProduced: z.coerce.number().int().min(0).default(1),
  failureQuantity: z.coerce.number().int().min(0).default(0),
  materials: z
    .array(
      z.object({
        filamentId: uuid.optional().nullable(),
        spoolId: uuid.optional().nullable(),
        weightG: z.coerce.number().min(0),
        pricePerKgSnapshot: z.coerce.number().min(0).optional(),
        allocationPercentage: z.coerce.number().min(0).max(100).optional().nullable(),
      }),
    )
    .default([]),
  laborCost: z.coerce.number().min(0).default(0),
  packagingCost: z.coerce.number().min(0).default(0),
  otherCost: z.coerce.number().min(0).default(0),
  failurePercentage: z.coerce.number().min(0).max(100).default(0),
});
export type ManualPrintJobInput = z.infer<typeof manualPrintJobSchema>;

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------
export const customerSchema = z.object({
  name: z.string().min(1).max(160),
  document: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().max(40).optional().nullable(),
  whatsapp: z.string().max(40).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  active: z.boolean().default(true),
});
export type CustomerInput = z.infer<typeof customerSchema>;

// ---------------------------------------------------------------------------
// Pedidos e pagamentos
// ---------------------------------------------------------------------------
export const orderStatusSchema = z.enum([
  'draft',
  'quoted',
  'approved',
  'in_production',
  'ready',
  'delivered',
  'cancelled',
]);

export const orderSchema = z.object({
  customerId: uuid.optional().nullable(),
  orderNumber: z.string().min(1).max(60),
  status: orderStatusSchema.default('draft'),
  dueAt: z.string().datetime().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  discount: z.coerce.number().min(0).default(0),
  shippingAmount: z.coerce.number().min(0).default(0),
  items: z
    .array(
      z.object({
        description: z.string().min(1).max(200),
        quantity: z.coerce.number().positive().default(1),
        unitPrice: z.coerce.number().min(0).default(0),
        laborCost: z.coerce.number().min(0).default(0),
        packagingCost: z.coerce.number().min(0).default(0),
        otherCost: z.coerce.number().min(0).default(0),
      }),
    )
    .default([]),
});
export type OrderInput = z.infer<typeof orderSchema>;

export const paymentSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentMethod: z.string().max(40).optional().nullable(),
  paidAt: z.string().datetime().optional().nullable(),
  status: z.enum(['pending', 'confirmed', 'refunded', 'cancelled']).default('confirmed'),
  notes: z.string().max(500).optional().nullable(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

// ---------------------------------------------------------------------------
// Integração Bambu
// ---------------------------------------------------------------------------
export const bambuConnectSchema = z.object({
  displayName: z.string().min(1).max(120),
  account: z.string().min(3).max(160),
  password: z.string().min(1),
  region: z.enum(['global', 'china']).default('global'),
});
export type BambuConnectInput = z.infer<typeof bambuConnectSchema>;

export const bambuVerifySchema = z.object({
  connectionId: uuid,
  code: z.string().min(4).max(12),
});
export type BambuVerifyInput = z.infer<typeof bambuVerifySchema>;
