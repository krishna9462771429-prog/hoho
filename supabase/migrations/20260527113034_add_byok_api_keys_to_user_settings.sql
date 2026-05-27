/*
  # Add BYOK (Bring Your Own Key) API Keys to User Settings

  ## Summary
  Adds fields for users to optionally use their own Groq and Gemini API keys
  instead of platform-level keys. This enables the BYOK feature while maintaining
  backward compatibility with existing platform keys.

  ## Changes
  1. New Columns Added to `user_settings`:
    - `groq_api_key` (text) - User's personal Groq API key (optional)
    - `gemini_api_key` (text) - User's personal Gemini API key (optional)
    - `use_personal_ai_keys` (boolean, default false) - Master toggle for BYOK feature

  ## Security
  - No additional RLS policies needed (existing user_settings policies cover these columns)
  - Keys are stored as plain text - frontend must mask when displaying
  - Keys are never logged or returned in full

  ## Backward Compatibility
  - All existing rows unaffected (new columns have safe defaults)
  - `use_personal_ai_keys` defaults to false, so platform keys continue to work
  - NULL values for API keys are allowed (platform keys will be used)

  ## Important Notes
  1. When `use_personal_ai_keys` is false: platform keys are always used
  2. When `use_personal_ai_keys` is true:
     - If personal Groq key exists → use it, else fallback to platform
     - If personal Gemini key exists → use it, else fallback to platform
  3. API keys should be validated before saving (via dedicated validation endpoint)
  4. Keys are never returned in full to the frontend - always masked
*/

-- Add BYOK columns to user_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'groq_api_key'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN groq_api_key text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'gemini_api_key'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN gemini_api_key text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'use_personal_ai_keys'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN use_personal_ai_keys boolean DEFAULT false;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN user_settings.groq_api_key IS 'User personal Groq API key for BYOK feature. NULL = use platform key.';
COMMENT ON COLUMN user_settings.gemini_api_key IS 'User personal Gemini API key for BYOK feature. NULL = use platform key.';
COMMENT ON COLUMN user_settings.use_personal_ai_keys IS 'Master toggle for BYOK. When true, personal keys take priority over platform keys.';
