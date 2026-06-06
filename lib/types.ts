export type WorkloadType = 'inference' | 'training' | 'idle'
export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type RecommendationType = 'cooling_adjustment' | 'workload_shift' | 'server_consolidation' | 'alert'
export type RecommendationStatus = 'pending' | 'applied' | 'dismissed'
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low'
export type AlertType = 'temperature' | 'power' | 'performance' | 'cooling'

export interface ServerTelemetry {
  id: string
  server_id: string
  rack_id: string
  cpu_pct: number
  ram_pct: number
  temp_c: number
  power_w: number
  workload_type: WorkloadType
  is_scheduled: boolean
  timestamp: string
}

export interface CoolingState {
  id: string
  unit_id: string
  setpoint_c: number
  fan_speed_pct: number
  power_w: number
  timestamp: string
}

export interface EnergyPrice {
  id: string
  price_per_kwh: number
  renewable_pct: number
  timestamp: string
}

export interface AiRecommendation {
  id: string
  type: RecommendationType
  priority: Priority
  description: string
  action: string
  estimated_kwh_savings: number
  estimated_usd_savings: number
  confidence: number
  status: RecommendationStatus
  created_at: string
}

export interface Alert {
  id: string
  server_id: string | null
  severity: AlertSeverity
  type: AlertType
  message: string
  resolved: boolean
  resolved_at: string | null
  created_at: string
}

// API response shapes
export interface TelemetrySnapshot {
  servers: ServerTelemetry[]
  cooling: CoolingState[]
  price: EnergyPrice
}

export interface HistoryBucket {
  timestamp: string
  total_kw: number
  cooling_kw: number
  pue: number
}

export interface MetricSummary {
  total_kwh: number
  avg_pue: number
  peak_kw: number
  total_cost_usd: number
  total_co2_kg: number
  renewable_pct: number
}

export interface MetricsResponse {
  current: MetricSummary
  prior: MetricSummary
}

export interface GridMindSettings {
  electricityCostPerKwh: number
  co2Factor: number
}

export const DEFAULT_SETTINGS: GridMindSettings = {
  electricityCostPerKwh: 0.12,
  co2Factor: 0.4,
}
