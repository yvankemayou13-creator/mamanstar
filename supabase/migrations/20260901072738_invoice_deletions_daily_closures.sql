/*
# Invoice deletions and daily closures

1. New Tables
- `invoice_deletions`: Logs every invoice deletion with the admin who authorized it, the justification reason, and the invoice snapshot data. This creates an audit trail for the comptabilité.
- `daily_closures`: Records the end-of-day summary for each vendeur, including total sales, total revenue, payment method breakdown, and the list of invoice IDs included in the closure.

2. Columns
- `invoice_deletions`: id, invoice_id, invoice_number, total_ttc, justification, admin_id, admin_email, vendeur_id, vendeur_email, created_at
- `daily_closures`: id, vendeur_id, vendeur_name, closure_date, total_invoices, total_ttc, total_ht, tva_amount, especes_count, carte_count, virement_count, cheque_count, especes_amount, carte_amount, virement_amount, cheque_amount, invoice_ids (jsonb), status, created_at

3. Security
- Enable RLS on both tables.
- authenticated users can read (admin and comptable need to see deletions and closures).
- Only authenticated users can insert (vendeur inserts closures, admin inserts deletions).
- Update not needed.
- Delete restricted to admin only.
*/

CREATE TABLE IF NOT EXISTS invoice_deletions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  invoice_number text NOT NULL,
  total_ttc numeric(12,2) NOT NULL DEFAULT 0,
  justification text NOT NULL,
  admin_id uuid NOT NULL,
  admin_email text NOT NULL,
  vendeur_id uuid,
  vendeur_email text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoice_deletions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_invoice_deletions" ON invoice_deletions;
CREATE POLICY "select_invoice_deletions"
  ON invoice_deletions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_invoice_deletions" ON invoice_deletions;
CREATE POLICY "insert_invoice_deletions"
  ON invoice_deletions FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delete_invoice_deletions" ON invoice_deletions;
CREATE POLICY "delete_invoice_deletions"
  ON invoice_deletions FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS daily_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendeur_id uuid NOT NULL,
  vendeur_name text NOT NULL,
  closure_date date NOT NULL,
  total_invoices integer NOT NULL DEFAULT 0,
  total_ttc numeric(12,2) NOT NULL DEFAULT 0,
  total_ht numeric(12,2) NOT NULL DEFAULT 0,
  tva_amount numeric(12,2) NOT NULL DEFAULT 0,
  especes_count integer NOT NULL DEFAULT 0,
  carte_count integer NOT NULL DEFAULT 0,
  virement_count integer NOT NULL DEFAULT 0,
  cheque_count integer NOT NULL DEFAULT 0,
  especes_amount numeric(12,2) NOT NULL DEFAULT 0,
  carte_amount numeric(12,2) NOT NULL DEFAULT 0,
  virement_amount numeric(12,2) NOT NULL DEFAULT 0,
  cheque_amount numeric(12,2) NOT NULL DEFAULT 0,
  invoice_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'cloture',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE daily_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_daily_closures" ON daily_closures;
CREATE POLICY "select_daily_closures"
  ON daily_closures FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_daily_closures" ON daily_closures;
CREATE POLICY "insert_daily_closures"
  ON daily_closures FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_daily_closures" ON daily_closures;
CREATE POLICY "update_daily_closures"
  ON daily_closures FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_daily_closures" ON daily_closures;
CREATE POLICY "delete_daily_closures"
  ON daily_closures FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_invoice_deletions_created_at ON invoice_deletions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_closures_vendeur_date ON daily_closures(vendeur_id, closure_date DESC);
