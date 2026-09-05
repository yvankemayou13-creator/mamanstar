/*
# Admin password reset codes

1. New Tables
- `admin_reset_codes` - stores temporary reset codes for admin password recovery
  - `id` (uuid, primary key)
  - `email` (text, the admin email requesting reset)
  - `code` (text, 6-digit code)
  - `used` (boolean, default false)
  - `expires_at` (timestamptz, 15 minutes from creation)
  - `created_at` (timestamptz)

2. Security
- Enable RLS on `admin_reset_codes`.
- No direct access from client (anon/authenticated) - only the edge function with service role key accesses this table.
*/

CREATE TABLE IF NOT EXISTS admin_reset_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  used boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_reset_codes ENABLE ROW LEVEL SECURITY;

-- Deny all direct access from anon and authenticated
DROP POLICY IF EXISTS "deny_all_admin_reset_codes" ON admin_reset_codes;
CREATE POLICY "deny_all_admin_reset_codes"
  ON admin_reset_codes FOR ALL
  TO anon, authenticated
  USING (false) WITH CHECK (false);
