import { z } from 'zod'
import { SERVERS } from './telemetry-sim'

const VALID_SERVER_IDS = SERVERS.map(s => s.id) as [string, ...string[]]

export const RecommendationSchema = z.object({
  type: z.enum(['cooling_adjustment', 'workload_shift', 'server_consolidation', 'alert']),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  description: z.string().min(1),
  action: z.string().min(1),
  estimated_kwh_savings: z.number().min(0),
  estimated_usd_savings: z.number().min(0),
  confidence: z.number().min(0).max(1),
})

export const RecommendationsArraySchema = z.array(RecommendationSchema)

export const HistoryRangeSchema = z.enum(['24h', '7d', '30d'])

export const MetricsQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  co2Factor: z.coerce.number().min(0).max(5).default(0.4),
})

export const AlertPatchSchema = z.object({
  resolved: z.literal(true),
})

export const RecommendationPatchSchema = z.object({
  status: z.enum(['applied', 'dismissed']),
})

export const SchedulerApplySchema = z.object({
  assignments: z.array(z.object({
    serverId: z.enum(VALID_SERVER_IDS),
    hour: z.number().int().min(0).max(23),
    workloadType: z.enum(['inference', 'training', 'idle']),
  })).min(1),
})

export const ReportBodySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  co2Factor: z.number().min(0).max(5).default(0.4),
})
