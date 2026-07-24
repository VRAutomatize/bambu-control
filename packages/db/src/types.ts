/**
 * Tipos do banco no formato esperado pelo supabase-js. Escrito à mão a partir
 * das migrations (em produção, regenerar com `supabase gen types typescript`).
 *
 * NOTA: colunas numeric/bigint podem chegar como string via PostgREST para
 * preservar precisão. Trate valores monetários com o motor de custos / Zod
 * (coerção) ao ler. Aqui tipamos como number por ergonomia.
 */

type Ts = string;
type Uuid = string;
type Json = Record<string, unknown> | unknown[] | null;

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type OrgRole = 'owner' | 'admin' | 'operator' | 'viewer';
export type NormalizedStatus =
  | 'pending'
  | 'printing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'unknown';

export type OrganizationRow = {
  id: Uuid;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  created_at: Ts;
  updated_at: Ts;
}

export type OrganizationMemberRow = {
  id: Uuid;
  organization_id: Uuid;
  user_id: Uuid;
  role: OrgRole;
  created_at: Ts;
}

export type OrganizationInviteRow = {
  id: Uuid;
  organization_id: Uuid;
  email: string;
  role: OrgRole;
  token: string;
  expires_at: Ts;
  accepted_at: Ts | null;
  created_at: Ts;
}

export type ProfileRow = {
  id: Uuid;
  full_name: string | null;
  avatar_url: string | null;
  created_at: Ts;
  updated_at: Ts;
}

export type MachineCostProfileRow = {
  id: Uuid;
  organization_id: Uuid;
  name: string;
  calculation_mode: 'direct_hourly_rate' | 'calculated';
  direct_hourly_cost: number;
  purchase_price: number;
  residual_value: number;
  useful_life_hours: number;
  average_power_w: number;
  electricity_price_kwh: number;
  maintenance_cost_per_hour: number;
  overhead_cost_per_hour: number;
  created_at: Ts;
  updated_at: Ts;
}

export type ProviderConnectionRow = {
  id: Uuid;
  organization_id: Uuid;
  provider: 'bambu_cloud' | 'bambu_lan' | 'manual' | 'simplyprint' | 'generic';
  display_name: string;
  status: 'pending_verification' | 'connected' | 'expired' | 'error' | 'disconnected';
  encrypted_credentials: string | null;
  token_expires_at: Ts | null;
  last_sync_cursor: string | null;
  last_synced_at: Ts | null;
  last_error_code: string | null;
  last_error_message: string | null;
  created_by: Uuid | null;
  created_at: Ts;
  updated_at: Ts;
}

export type PrinterRow = {
  id: Uuid;
  organization_id: Uuid;
  provider_connection_id: Uuid | null;
  external_device_id: string | null;
  serial_number: string | null;
  name: string;
  model: string | null;
  location: string | null;
  active: boolean;
  last_seen_at: Ts | null;
  machine_cost_profile_id: Uuid | null;
  metadata_json: Json;
  created_at: Ts;
  updated_at: Ts;
}

export type FilamentRow = {
  id: Uuid;
  organization_id: Uuid;
  brand: string | null;
  name: string;
  material: string | null;
  color_name: string | null;
  color_hex: string | null;
  diameter_mm: number;
  default_price_per_kg: number;
  density: number | null;
  active: boolean;
  created_at: Ts;
  updated_at: Ts;
}

export type SpoolRow = {
  id: Uuid;
  organization_id: Uuid;
  filament_id: Uuid;
  label: string | null;
  supplier: string | null;
  purchase_price: number;
  initial_net_weight_g: number;
  remaining_weight_g: number;
  purchased_at: string | null;
  lot_number: string | null;
  status: 'sealed' | 'active' | 'empty' | 'archived';
  created_at: Ts;
  updated_at: Ts;
}

export type PrintJobRow = {
  id: Uuid;
  organization_id: Uuid;
  provider_connection_id: Uuid | null;
  printer_id: Uuid | null;
  external_task_id: string | null;
  external_model_id: string | null;
  title: string | null;
  cover_url: string | null;
  provider_status: string | null;
  manual_status: NormalizedStatus | null;
  normalized_status: NormalizedStatus;
  provider_start_at: Ts | null;
  provider_end_at: Ts | null;
  provider_duration_s: number | null;
  manual_duration_s: number | null;
  effective_duration_s: number | null;
  provider_weight_g: number | null;
  manual_weight_g: number | null;
  effective_weight_g: number | null;
  duration_source: string | null;
  quantity_produced: number;
  failure_quantity: number;
  source: string;
  raw_payload_json: Json;
  imported_at: Ts | null;
  last_synced_at: Ts | null;
  created_at: Ts;
  updated_at: Ts;
}

export type PrintJobMaterialRow = {
  id: Uuid;
  organization_id: Uuid;
  print_job_id: Uuid;
  filament_id: Uuid | null;
  spool_id: Uuid | null;
  source: 'provider_ams' | 'manual' | 'default_spool' | 'estimated';
  weight_g: number;
  price_per_kg_snapshot: number;
  material_cost_snapshot: number;
  allocation_percentage: number | null;
  created_at: Ts;
  updated_at: Ts;
}

export type PrintCostSnapshotRow = {
  id: Uuid;
  organization_id: Uuid;
  print_job_id: Uuid;
  calculation_version: number;
  material_cost: number;
  electricity_cost: number;
  depreciation_cost: number;
  maintenance_cost: number;
  machine_overhead_cost: number;
  labor_cost: number;
  failure_allowance_cost: number;
  packaging_cost: number;
  other_cost: number;
  total_cost: number;
  estimated: boolean;
  calculated_at: Ts;
  calculation_input_json: Json;
}

export type CustomerRow = {
  id: Uuid;
  organization_id: Uuid;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  notes: string | null;
  active: boolean;
  created_at: Ts;
  updated_at: Ts;
}

export type OrderRow = {
  id: Uuid;
  organization_id: Uuid;
  customer_id: Uuid | null;
  order_number: string;
  status: 'draft' | 'quoted' | 'approved' | 'in_production' | 'ready' | 'delivered' | 'cancelled';
  ordered_at: Ts | null;
  due_at: Ts | null;
  completed_at: Ts | null;
  notes: string | null;
  subtotal: number;
  discount: number;
  shipping_amount: number;
  total_charged: number;
  total_paid: number;
  created_at: Ts;
  updated_at: Ts;
}

export type OrderItemRow = {
  id: Uuid;
  organization_id: Uuid;
  order_id: Uuid;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  labor_cost: number;
  packaging_cost: number;
  other_cost: number;
  created_at: Ts;
  updated_at: Ts;
}

export type OrderItemPrintJobRow = {
  id: Uuid;
  organization_id: Uuid;
  order_item_id: Uuid;
  print_job_id: Uuid;
  allocated_quantity: number;
  allocated_revenue: number;
  created_at: Ts;
}

export type PaymentRow = {
  id: Uuid;
  organization_id: Uuid;
  order_id: Uuid;
  amount: number;
  payment_method: string | null;
  paid_at: Ts | null;
  status: 'pending' | 'confirmed' | 'refunded' | 'cancelled';
  notes: string | null;
  created_at: Ts;
}

export type SyncRunRow = {
  id: Uuid;
  organization_id: Uuid;
  provider_connection_id: Uuid | null;
  status: 'running' | 'success' | 'partial' | 'error';
  started_at: Ts;
  finished_at: Ts | null;
  cursor_before: string | null;
  cursor_after: string | null;
  records_received: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  error_code: string | null;
  error_message: string | null;
  metadata_json: Json;
}

export type AuditLogRow = {
  id: Uuid;
  organization_id: Uuid;
  actor_user_id: Uuid | null;
  action: string;
  entity_type: string;
  entity_id: Uuid | null;
  before_json: Json;
  after_json: Json;
  created_at: Ts;
}

export interface Database {
  public: {
    Tables: {
      organizations: Table<OrganizationRow>;
      organization_members: Table<OrganizationMemberRow>;
      organization_invites: Table<OrganizationInviteRow>;
      profiles: Table<ProfileRow>;
      machine_cost_profiles: Table<MachineCostProfileRow>;
      provider_connections: Table<ProviderConnectionRow>;
      printers: Table<PrinterRow>;
      filaments: Table<FilamentRow>;
      spools: Table<SpoolRow>;
      print_jobs: Table<PrintJobRow>;
      print_job_materials: Table<PrintJobMaterialRow>;
      print_cost_snapshots: Table<PrintCostSnapshotRow>;
      customers: Table<CustomerRow>;
      orders: Table<OrderRow>;
      order_items: Table<OrderItemRow>;
      order_item_print_jobs: Table<OrderItemPrintJobRow>;
      payments: Table<PaymentRow>;
      sync_runs: Table<SyncRunRow>;
      audit_logs: Table<AuditLogRow>;
    };
    Views: {
      latest_print_cost_snapshots: { Row: PrintCostSnapshotRow; Relationships: [] };
    };
    Functions: {
      create_organization: {
        Args: { p_name: string; p_slug: string; p_currency?: string; p_timezone?: string };
        Returns: OrganizationRow;
      };
      accept_organization_invite: {
        Args: { p_token: string };
        Returns: Array<{ success: boolean; message: string; organization_id: Uuid | null }>;
      };
    };
    Enums: { org_role: OrgRole };
    CompositeTypes: Record<string, never>;
  };
}
