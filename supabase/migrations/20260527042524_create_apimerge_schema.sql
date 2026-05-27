/*
  # APIMerge Full Schema

  ## Summary
  Creates all tables needed for the APIMerge SaaS platform.

  ## Tables
  1. user_profiles - Extended user data linked to Supabase auth
  2. user_settings - Per-user configuration (AI provider, alerts, retries, etc.)
  3. apis - Registered API endpoints for monitoring
  4. api_logs - Individual request/response logs per API check
  5. alerts - Alert configurations per API
  6. workflows - API merge/orchestration workflows
  7. ticker_services - Keep-alive URLs for Render/Vercel
  8. monitoring_logs - Scheduled monitoring job results
  9. ai_fallbacks - AI-generated fallback responses
  10. provider_usage - AI provider call tracking
  11. analytics_snapshots - Periodic aggregated analytics
  12. cache_entries - Cached AI responses

  ## Security
  - RLS enabled on all tables
  - Users can only access their own data
*/

-- user_profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid()::TEXT = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::TEXT = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid()::TEXT = id)
  WITH CHECK (auth.uid()::TEXT = id);

-- user_settings
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  default_timeout INTEGER DEFAULT 5000,
  default_retries INTEGER DEFAULT 3,
  ai_provider TEXT DEFAULT 'groq',
  alert_email_enabled BOOLEAN DEFAULT true,
  alert_discord_enabled BOOLEAN DEFAULT false,
  discord_webhook_url TEXT DEFAULT '',
  notification_email TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  TO authenticated
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  TO authenticated
  USING (auth.uid()::TEXT = user_id)
  WITH CHECK (auth.uid()::TEXT = user_id);

-- apis
CREATE TABLE IF NOT EXISTS apis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  method TEXT DEFAULT 'GET',
  headers JSONB DEFAULT '{}',
  body JSONB DEFAULT NULL,
  timeout INTEGER DEFAULT 5000,
  retries INTEGER DEFAULT 3,
  interval_seconds INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  tags TEXT[] DEFAULT '{}',
  expected_status INTEGER DEFAULT 200,
  uptime_percent NUMERIC(5,2) DEFAULT 100.00,
  total_checks INTEGER DEFAULT 0,
  failed_checks INTEGER DEFAULT 0,
  last_checked_at TIMESTAMPTZ,
  last_status TEXT DEFAULT 'unknown',
  last_latency_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE apis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own apis"
  ON apis FOR SELECT
  TO authenticated
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert own apis"
  ON apis FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can update own apis"
  ON apis FOR UPDATE
  TO authenticated
  USING (auth.uid()::TEXT = user_id)
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can delete own apis"
  ON apis FOR DELETE
  TO authenticated
  USING (auth.uid()::TEXT = user_id);

-- api_logs
CREATE TABLE IF NOT EXISTS api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id UUID NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  status_code INTEGER,
  latency_ms INTEGER DEFAULT 0,
  response_body TEXT DEFAULT '',
  error_message TEXT DEFAULT '',
  is_fallback BOOLEAN DEFAULT false,
  fallback_provider TEXT DEFAULT '',
  checked_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs"
  ON api_logs FOR SELECT
  TO authenticated
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert own logs"
  ON api_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::TEXT = user_id);

-- alerts
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  api_id UUID REFERENCES apis(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  threshold_value INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts"
  ON alerts FOR SELECT
  TO authenticated
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert own alerts"
  ON alerts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can update own alerts"
  ON alerts FOR UPDATE
  TO authenticated
  USING (auth.uid()::TEXT = user_id)
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can delete own alerts"
  ON alerts FOR DELETE
  TO authenticated
  USING (auth.uid()::TEXT = user_id);

-- workflows
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  api_ids UUID[] DEFAULT '{}',
  merge_strategy TEXT DEFAULT 'merge',
  response_template JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  endpoint_slug TEXT UNIQUE,
  total_calls INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workflows"
  ON workflows FOR SELECT
  TO authenticated
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert own workflows"
  ON workflows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can update own workflows"
  ON workflows FOR UPDATE
  TO authenticated
  USING (auth.uid()::TEXT = user_id)
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can delete own workflows"
  ON workflows FOR DELETE
  TO authenticated
  USING (auth.uid()::TEXT = user_id);

-- ticker_services
CREATE TABLE IF NOT EXISTS ticker_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  interval_seconds INTEGER DEFAULT 300,
  is_active BOOLEAN DEFAULT true,
  last_pinged_at TIMESTAMPTZ,
  last_status TEXT DEFAULT 'unknown',
  ping_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ticker_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ticker services"
  ON ticker_services FOR SELECT
  TO authenticated
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert own ticker services"
  ON ticker_services FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can update own ticker services"
  ON ticker_services FOR UPDATE
  TO authenticated
  USING (auth.uid()::TEXT = user_id)
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can delete own ticker services"
  ON ticker_services FOR DELETE
  TO authenticated
  USING (auth.uid()::TEXT = user_id);

-- monitoring_logs
CREATE TABLE IF NOT EXISTS monitoring_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  service_type TEXT NOT NULL,
  service_id UUID NOT NULL,
  status TEXT NOT NULL,
  message TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}',
  logged_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE monitoring_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own monitoring logs"
  ON monitoring_logs FOR SELECT
  TO authenticated
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert own monitoring logs"
  ON monitoring_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::TEXT = user_id);

-- ai_fallbacks
CREATE TABLE IF NOT EXISTS ai_fallbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  api_id UUID REFERENCES apis(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  prompt TEXT DEFAULT '',
  response JSONB DEFAULT '{}',
  failure_reason TEXT DEFAULT '',
  latency_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_fallbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai fallbacks"
  ON ai_fallbacks FOR SELECT
  TO authenticated
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert own ai fallbacks"
  ON ai_fallbacks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::TEXT = user_id);

-- provider_usage
CREATE TABLE IF NOT EXISTS provider_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  action_type TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE provider_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own provider usage"
  ON provider_usage FOR SELECT
  TO authenticated
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert own provider usage"
  ON provider_usage FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::TEXT = user_id);

-- analytics_snapshots
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  avg_latency_ms INTEGER DEFAULT 0,
  ai_fallback_count INTEGER DEFAULT 0,
  uptime_percent NUMERIC(5,2) DEFAULT 100.00,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, snapshot_date)
);

ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analytics"
  ON analytics_snapshots FOR SELECT
  TO authenticated
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert own analytics"
  ON analytics_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can update own analytics"
  ON analytics_snapshots FOR UPDATE
  TO authenticated
  USING (auth.uid()::TEXT = user_id)
  WITH CHECK (auth.uid()::TEXT = user_id);

-- cache_entries
CREATE TABLE IF NOT EXISTS cache_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  cache_value JSONB NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, cache_key)
);

ALTER TABLE cache_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cache"
  ON cache_entries FOR SELECT
  TO authenticated
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert own cache"
  ON cache_entries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can update own cache"
  ON cache_entries FOR UPDATE
  TO authenticated
  USING (auth.uid()::TEXT = user_id)
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can delete own cache"
  ON cache_entries FOR DELETE
  TO authenticated
  USING (auth.uid()::TEXT = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_apis_user_id ON apis(user_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_api_id ON api_logs(api_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_user_id ON api_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_checked_at ON api_logs(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_ticker_user_id ON ticker_services(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_fallbacks_user_id ON ai_fallbacks(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_user_date ON analytics_snapshots(user_id, snapshot_date);
