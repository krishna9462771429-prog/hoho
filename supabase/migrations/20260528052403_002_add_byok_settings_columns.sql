/*
  # Add BYOK (Bring Your Own Key) columns to user_settings
  
  1. New Columns
    - `use_personal_keys` - Boolean flag to enable personal AI keys
    - `has_groq_key` - Flag indicating if Groq key is stored
    - `has_gemini_key` - Flag indicating if Gemini key is stored
  
  2. Details
    - Columns are optional and default to false
    - Actual encrypted keys are stored in a separate secure table
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'use_personal_keys'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN use_personal_keys BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'has_groq_key'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN has_groq_key BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'has_gemini_key'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN has_gemini_key BOOLEAN DEFAULT false;
  END IF;
END $$;