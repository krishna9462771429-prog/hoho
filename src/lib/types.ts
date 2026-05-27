export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  default_timeout: number;
  default_retries: number;
  ai_provider: string;
  alert_email_enabled: boolean;
  alert_discord_enabled: boolean;
  discord_webhook_url: string;
  notification_email: string;
  created_at: string;
  updated_at: string;
  use_personal_ai_keys?: boolean;
  groq_api_key?: string;
  gemini_api_key?: string;
}

export interface BYOKCredentials {
  groq_key_masked: string | null;
  gemini_key_masked: string | null;
  groq_source: "user" | "platform";
  gemini_source: "user" | "platform";
  use_personal_ai_keys: boolean;
  has_groq_key: boolean;
  has_gemini_key: boolean;
}

export interface Api {
  id: string;
  user_id: string;
  name: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
  timeout: number;
  retries: number;
  interval_seconds: number;
  is_active: boolean;
  tags: string[];
  expected_status: number;
  uptime_percent: number;
  total_checks: number;
  failed_checks: number;
  last_checked_at: string | null;
  last_status: string;
  last_latency_ms: number;
  created_at: string;
  updated_at: string;
}

export interface ApiLog {
  id: string;
  api_id: string;
  user_id: string;
  status: string;
  status_code: number | null;
  latency_ms: number;
  response_body: string;
  error_message: string;
  is_fallback: boolean;
  fallback_provider: string;
  checked_at: string;
  api_name?: string;
}

export interface Alert {
  id: string;
  user_id: string;
  api_id: string | null;
  alert_type: string;
  threshold_value: number;
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

export interface Workflow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  api_ids: string[];
  merge_strategy: string;
  response_template: Record<string, unknown>;
  is_active: boolean;
  endpoint_slug: string;
  total_calls: number;
  created_at: string;
  updated_at: string;
}

export interface TickerService {
  id: string;
  user_id: string;
  name: string;
  url: string;
  interval_seconds: number;
  is_active: boolean;
  last_pinged_at: string | null;
  last_status: string;
  ping_count: number;
  created_at: string;
  updated_at: string;
}

export interface AIFallback {
  id: string;
  user_id: string;
  api_id: string | null;
  provider: string;
  prompt: string;
  response: Record<string, unknown>;
  failure_reason: string;
  latency_ms: number;
  created_at: string;
}

export interface AnalyticsSnapshot {
  id: string;
  user_id: string;
  snapshot_date: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  avg_latency_ms: number;
  ai_fallback_count: number;
  uptime_percent: number;
  created_at: string;
}

export interface DashboardStats {
  total_apis: number;
  active_apis: number;
  avg_uptime: number;
  total_checks_today: number;
  failed_checks_today: number;
  ai_fallbacks_today: number;
  avg_latency_ms: number;
}
