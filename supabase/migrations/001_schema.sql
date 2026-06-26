-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- server_telemetry
CREATE TABLE server_telemetry (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id     text NOT NULL,
  rack_id       text NOT NULL,
  cpu_pct       numeric(5,2)  NOT NULL,
  ram_pct       numeric(5,2)  NOT NULL,
  temp_c        numeric(5,2)  NOT NULL,
  power_w       numeric(8,2)  NOT NULL,
  workload_type text          NOT NULL
                CHECK (workload_type IN ('inference','training','idle')),
  is_scheduled  boolean       NOT NULL DEFAULT false,
  timestamp     timestamptz   NOT NULL DEFAULT now()
);

-- cooling_state
CREATE TABLE cooling_state (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id       text         NOT NULL,
  setpoint_c    numeric(5,2) NOT NULL,
  fan_speed_pct numeric(5,2) NOT NULL,
  power_w       numeric(8,2) NOT NULL,
  timestamp     timestamptz  NOT NULL DEFAULT now()
);

-- energy_prices
CREATE TABLE energy_prices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_per_kwh numeric(6,4) NOT NULL,
  renewable_pct numeric(5,2) NOT NULL,
  timestamp     timestamptz  NOT NULL DEFAULT now()
);

-- ai_recommendations
CREATE TABLE ai_recommendations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type                  text         NOT NULL
                        CHECK (type IN ('cooling_adjustment','workload_shift','server_consolidation','alert')),
  priority              text         NOT NULL
                        CHECK (priority IN ('critical','high','medium','low')),
  description           text         NOT NULL,
  action                text         NOT NULL,
  estimated_kwh_savings numeric(10,2) NOT NULL DEFAULT 0,
  estimated_usd_savings numeric(10,2) NOT NULL DEFAULT 0,
  confidence            numeric(4,3)  NOT NULL DEFAULT 0
                        CHECK (confidence BETWEEN 0 AND 1),
  status                text         NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','applied','dismissed')),
  created_at            timestamptz  NOT NULL DEFAULT now()
);

-- alerts
CREATE TABLE alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   text,
  severity    text        NOT NULL
              CHECK (severity IN ('critical','high','medium','low')),
  type        text        NOT NULL
              CHECK (type IN ('temperature','power','performance','cooling')),
  message     text        NOT NULL,
  resolved    boolean     NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_server_telemetry_timestamp     ON server_telemetry (timestamp DESC);
CREATE INDEX idx_server_telemetry_server_time   ON server_telemetry (server_id, timestamp DESC);
CREATE INDEX idx_server_telemetry_live_snapshot ON server_telemetry (server_id, timestamp DESC)
  WHERE is_scheduled = false;
CREATE INDEX idx_cooling_state_timestamp        ON cooling_state (timestamp DESC);
CREATE INDEX idx_energy_prices_timestamp        ON energy_prices (timestamp DESC);
CREATE INDEX idx_alerts_status_time             ON alerts (resolved, created_at DESC);
CREATE INDEX idx_recommendations_status_time    ON ai_recommendations (status, created_at DESC);
CREATE INDEX idx_recommendations_priority_time  ON ai_recommendations (priority, created_at DESC);

-- RLS: enable but allow service key to bypass
ALTER TABLE server_telemetry    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooling_state       ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_prices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts              ENABLE ROW LEVEL SECURITY;

-- Anon read-only policies
CREATE POLICY "anon_read" ON server_telemetry    FOR SELECT USING (true);
CREATE POLICY "anon_read" ON cooling_state       FOR SELECT USING (true);
CREATE POLICY "anon_read" ON energy_prices       FOR SELECT USING (true);
CREATE POLICY "anon_read" ON ai_recommendations  FOR SELECT USING (true);
CREATE POLICY "anon_read" ON alerts              FOR SELECT USING (true);
