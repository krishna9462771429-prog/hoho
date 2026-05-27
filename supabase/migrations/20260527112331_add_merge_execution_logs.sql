/*
  # Add Merge Execution Logs

  ## Summary
  Adds a dedicated `merge_execution_logs` table to persist rich metadata
  from every Advanced Merge Engine run.

  ## New Tables

  ### merge_execution_logs
  Stores one row per workflow execution with:
  - `id`                  UUID primary key
  - `user_id`             References auth.users
  - `workflow_id`         Optional FK to workflows (nullable for ad-hoc executions)
  - `strategy`            Merge strategy used (merge/first_success/all_required/majority_success/fallback_chain)
  - `successful_apis`     Count of APIs that returned successfully
  - `failed_apis`         Count of APIs that failed
  - `total_apis`          Total APIs in the execution
  - `execution_time_ms`   Wall-clock time for the full execution
  - `overall_success`     Boolean: did the strategy consider this execution a success
  - `api_ids`             Array of API UUIDs included in this execution
  - `metadata`            JSONB: latencies, status_codes, response_sizes, retry_counts
  - `error_summary`       JSONB array of failed-API error details
  - `executed_at`         Timestamptz, default now()

  ## Security
  - RLS enabled
  - SELECT policy: users can only read their own execution logs
  - INSERT policy: users can only insert their own execution logs

  ## Indexes
  - user_id for per-user queries
  - workflow_id for per-workflow history
  - executed_at DESC for recency ordering
*/

CREATE TABLE IF NOT EXISTS merge_execution_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT NOT NULL,
  workflow_id       UUID REFERENCES workflows(id) ON DELETE SET NULL,
  strategy          TEXT NOT NULL DEFAULT 'merge',
  successful_apis   INTEGER NOT NULL DEFAULT 0,
  failed_apis       INTEGER NOT NULL DEFAULT 0,
  total_apis        INTEGER NOT NULL DEFAULT 0,
  execution_time_ms INTEGER NOT NULL DEFAULT 0,
  overall_success   BOOLEAN NOT NULL DEFAULT false,
  api_ids           UUID[] DEFAULT '{}',
  metadata          JSONB DEFAULT '{}',
  error_summary     JSONB DEFAULT '[]',
  executed_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE merge_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own merge execution logs"
  ON merge_execution_logs FOR SELECT
  TO authenticated
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert own merge execution logs"
  ON merge_execution_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE INDEX IF NOT EXISTS idx_merge_exec_user_id
  ON merge_execution_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_merge_exec_workflow_id
  ON merge_execution_logs(workflow_id)
  WHERE workflow_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_merge_exec_executed_at
  ON merge_execution_logs(executed_at DESC);
