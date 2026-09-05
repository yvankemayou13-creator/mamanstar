/*
# Add username to profiles and create app_settings table

1. Changes to existing tables
- `profiles`: add `username` column (text) for username-based login

2. New Tables
- `app_settings`: key-value store for application-wide configurable settings

3. Security
- RLS enabled on `app_settings`
- Authenticated users can read/write
*/

-- Add username column to profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'username') THEN
    ALTER TABLE profiles ADD COLUMN username text;
  END IF;
END $$;

-- Create app_settings key-value table
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_app_settings" ON app_settings;
CREATE POLICY "select_app_settings" ON app_settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_app_settings" ON app_settings;
CREATE POLICY "insert_app_settings" ON app_settings FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_app_settings" ON app_settings;
CREATE POLICY "update_app_settings" ON app_settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_app_settings" ON app_settings;
CREATE POLICY "delete_app_settings" ON app_settings FOR DELETE
  TO authenticated USING (true);
