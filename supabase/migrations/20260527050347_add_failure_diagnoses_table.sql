/*
  # Failure Diagnoses Table

  ## Summary
  Stores AI-generated failure diagnoses for API failures.

  ## Table
  - failure_diagnoses
    - id (uuid, primary key)
    - user_id (text, references user_profiles)
    - api_id (uuid, references apis)
    - diagnosis (text) - AI-generated root cause analysis
    - severity (text) - low/medium/high/critical
    - confidence (numeric) - 0.0 to 1.0
    - suggested_fix (text) - Recommended remediation
    - recommended_action (text) - retry/skip/escalate/investigate
    - provider_used (text) - groq/gemini
    - raw_error (jsonb) - Original error details
    - failure_category (text) - timeout/auth/rate_limit/server/network/ssl/unknown
    - created_at (timestamp)

  ## Security
  - RLS enabled
  - Users can only access their own diagnoses
*/

CREATE TABLE IF NOT EXISTS failure_diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  api_id UUID REFERENCES apis(id) ON DELETE CASCADE,
  diagnosis TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  confidence NUMERIC(4,3) DEFAULT 0.00,
  suggested_fix TEXT DEFAULT '',
  recommended_action TEXT DEFAULT 'investigate',
  provider_used TEXT DEFAULT 'groq',
  raw_error JSONB DEFAULT '{}',
  failure_category TEXT DEFAULT 'unknown',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE failure_diagnoses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own diagnoses"
  ON failure_diagnoses FOR SELECT
  TO authenticated
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert own diagnoses"
  ON failure_diagnoses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE INDEX IF NOT EXISTS idx_failure_diagnoses_user_id ON failure_diagnoses(user_id);
CREATE INDEX IF NOT EXISTS idx_failure_diagnoses_api_id ON failure_diagnoses(api_id);
CREATE INDEX IF NOT EXISTS idx_failure_diagnoses_created_at ON failure_diagnoses(created_at DESC);
