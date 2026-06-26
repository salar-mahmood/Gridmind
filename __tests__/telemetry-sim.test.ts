import { generateTick, getPriceAt, getRenewableAt, SERVERS, CRAC_UNITS } from '@/lib/telemetry-sim'

describe('getPriceAt', () => {
  it('returns off-peak price at 3am', () => {
    expect(getPriceAt(3)).toBeLessThan(0.07)
  })
  it('returns peak price at 12pm', () => {
    expect(getPriceAt(12)).toBeGreaterThan(0.12)
  })
  it('returns shoulder price at 7am', () => {
    const p = getPriceAt(7)
    expect(p).toBeGreaterThan(0.07)
    expect(p).toBeLessThan(0.14)
  })
})

describe('getRenewableAt', () => {
  const now = new Date('2026-06-06T12:00:00Z')
  it('has higher renewable at noon than midnight', () => {
    const noon = getRenewableAt(12, now)
    const midnight = getRenewableAt(0, now)
    expect(noon).toBeGreaterThan(midnight)
  })
  it('returns value between 0 and 95', () => {
    for (let h = 0; h < 24; h++) {
      const r = getRenewableAt(h, now)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThanOrEqual(95)
    }
  })
})

describe('generateTick', () => {
  const now = new Date('2026-06-06T14:00:00Z')
  const tick = generateTick(now)

  it('produces 20 server rows', () => {
    expect(tick.servers).toHaveLength(20)
  })
  it('produces 4 cooling rows', () => {
    expect(tick.cooling).toHaveLength(4)
  })
  it('produces 1 price row', () => {
    expect(tick.price).toBeDefined()
    expect(tick.price.price_per_kwh).toBeGreaterThan(0)
  })
  it('all servers have valid ranges', () => {
    for (const s of tick.servers) {
      expect(s.cpu_pct).toBeGreaterThanOrEqual(0)
      expect(s.cpu_pct).toBeLessThanOrEqual(100)
      expect(s.temp_c).toBeGreaterThan(15)
      expect(s.temp_c).toBeLessThan(90)
      expect(s.power_w).toBeGreaterThan(0)
      expect(['inference','training','idle']).toContain(s.workload_type)
      expect(s.is_scheduled).toBe(false)
    }
  })
  it('server IDs are srv-01 through srv-20', () => {
    const ids = tick.servers.map(s => s.server_id)
    expect(ids).toContain('srv-01')
    expect(ids).toContain('srv-20')
  })
  it('rack IDs are rack-A through rack-D', () => {
    const racks = new Set(tick.servers.map(s => s.rack_id))
    expect(racks.size).toBe(4)
  })
})

describe('constants', () => {
  it('SERVERS has 20 entries', () => expect(SERVERS).toHaveLength(20))
  it('CRAC_UNITS has 4 entries', () => expect(CRAC_UNITS).toHaveLength(4))
})
