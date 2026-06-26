import {
  RecommendationsArraySchema,
  HistoryRangeSchema,
  MetricsQuerySchema,
  AlertPatchSchema,
  RecommendationPatchSchema,
  SchedulerApplySchema,
  ReportBodySchema,
} from '@/lib/validations'

describe('RecommendationsArraySchema', () => {
  it('accepts valid recommendation array', () => {
    const input = [{
      type: 'cooling_adjustment', priority: 'high',
      description: 'Raise setpoint', action: 'Set to 22C',
      estimated_kwh_savings: 10, estimated_usd_savings: 1.2, confidence: 0.85,
    }]
    expect(RecommendationsArraySchema.safeParse(input).success).toBe(true)
  })
  it('rejects invalid type', () => {
    const input = [{ type: 'bad_type', priority: 'high', description: 'x', action: 'x', estimated_kwh_savings: 0, estimated_usd_savings: 0, confidence: 0.5 }]
    expect(RecommendationsArraySchema.safeParse(input).success).toBe(false)
  })
  it('rejects confidence > 1', () => {
    const input = [{ type: 'alert', priority: 'low', description: 'x', action: 'x', estimated_kwh_savings: 0, estimated_usd_savings: 0, confidence: 1.5 }]
    expect(RecommendationsArraySchema.safeParse(input).success).toBe(false)
  })
})

describe('HistoryRangeSchema', () => {
  it('accepts valid ranges', () => {
    expect(HistoryRangeSchema.safeParse('24h').success).toBe(true)
    expect(HistoryRangeSchema.safeParse('7d').success).toBe(true)
    expect(HistoryRangeSchema.safeParse('30d').success).toBe(true)
  })
  it('rejects invalid', () => {
    expect(HistoryRangeSchema.safeParse('1y').success).toBe(false)
  })
})

describe('MetricsQuerySchema', () => {
  it('accepts valid ISO dates', () => {
    const r = MetricsQuerySchema.safeParse({ startDate: '2026-01-01', endDate: '2026-02-01' })
    expect(r.success).toBe(true)
  })
  it('defaults co2Factor to 0.4', () => {
    const r = MetricsQuerySchema.safeParse({ startDate: '2026-01-01', endDate: '2026-02-01' })
    expect(r.success && r.data.co2Factor).toBe(0.4)
  })
})

describe('SchedulerApplySchema', () => {
  it('rejects unknown server IDs', () => {
    const r = SchedulerApplySchema.safeParse({
      assignments: [{ serverId: 'srv-99', hour: 3, workloadType: 'training' }]
    })
    expect(r.success).toBe(false)
  })
  it('accepts valid assignments', () => {
    const r = SchedulerApplySchema.safeParse({
      assignments: [{ serverId: 'srv-01', hour: 3, workloadType: 'training' }]
    })
    expect(r.success).toBe(true)
  })
})
