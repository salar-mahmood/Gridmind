import Anthropic from '@anthropic-ai/sdk'

let _instance: Anthropic | null = null

function getInstance(): Anthropic {
  if (!_instance) {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) throw new Error('Missing ANTHROPIC_API_KEY')
    _instance = new Anthropic({ apiKey: key })
  }
  return _instance
}

// Lazy proxy — client is created on first use, not at import time.
export const anthropic = new Proxy({} as Anthropic, {
  get(_, prop) {
    return (getInstance() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export const MODEL = 'claude-sonnet-4-6'

export const OPTIMIZATION_SYSTEM_PROMPT = `You are GridMind's AI optimization engine, an expert in data center energy efficiency.
You will receive a JSON snapshot of real-time server telemetry, cooling state, electricity prices, and renewable energy availability.
Analyze the data and return a JSON array of optimization recommendations.
Each recommendation must follow this exact schema:
{ type, priority, description, action, estimated_kwh_savings, estimated_usd_savings, confidence }.
Be specific and quantitative. Focus on the highest-impact opportunities first.
Valid values: type = cooling_adjustment | workload_shift | server_consolidation | alert;
priority = critical | high | medium | low; confidence = 0.0 to 1.0.
Return ONLY the JSON array, no other text.`

export const REPORT_SYSTEM_PROMPT = `You are GridMind's reporting engine. Write concise, professional energy reports suitable for ESG reporting and management review.
You will receive a JSON object of aggregated energy metrics for a data center.
Write exactly 3 paragraphs: (1) performance summary, (2) efficiency highlights and concerns, (3) recommendations for the next period.
Be specific and quantitative. Use professional business language.`
