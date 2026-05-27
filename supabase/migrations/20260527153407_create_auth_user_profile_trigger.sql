/*
  # Create Auth User Profile Trigger

  ## Summary
  Creates a PostgreSQL trigger that automatically creates a user_profile and user_settings
  record when a new user signs up via Supabase Auth. This ensures referential integrity
  and eliminates the need for frontend RLS policy workarounds.

  ## Changes
  1. Creates a function `handle_new_user()` that:
     - Creates a user_profile with the auth user's ID and email
     - Creates user_settings with default configuration
     - Runs automatically on new auth.users records
  
  2. Creates a trigger `on_auth_user_created` on `auth.users` table
     - Fires AFTER INSERT
     - Calls handle_new_user() for each new user

  ## Security
  - Function runs as security definer with proper permissions
  - Only creates records on INSERT, never on UPDATE or DELETE
  - Uses auth user data (ID and email) which is already verified

  ## Important Notes
  1. This eliminates the need for frontend to insert into user_profiles
  2. Ensures every auth user has a profile and settings record
  3. Solves foreign key constraint violations
  4. Reduces frontend RLS complexity
*/

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create user profile
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
  VALUES (new.id, new.email, '', '')
  ON CONFLICT (id) DO NOTHING;

  -- Create user settings
  INSERT INTO public.user_settings (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$;

-- Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
