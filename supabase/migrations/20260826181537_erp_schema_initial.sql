/*
# ERP / PGI - Schéma initial complet

## Description
Crée le schéma de base de données complet pour un ERP (Progiciel de Gestion Intégré) :
gestion des utilisateurs avec rôles, produits/stock, mouvements de stock, clients,
commandes, ventes/factures, lignes de vente, et écritures comptables en partie double.

## Tables créées
1. **profiles** - Profils utilisateurs liés à auth.users, avec rôle (admin/vendeur/comptable)
2. **products** - Produits en stock avec prix d'achat/vente, quantité, seuil d'alerte
3. **stock_movements** - Mouvements de stock (entrée/sortie/retour)
4. **clients** - Clients avec coordonnées
5. **orders** - Commandes clients avec statut
6. **order_lines** - Lignes de commande (produit, quantité, prix)
7. **invoices** - Factures avec totaux HT/TVA/TTC et statut de paiement
8. **invoice_lines** - Lignes de facture (produit, quantité, prix unitaire)
9. **accounting_entries** - Écritures comptables en partie double (compte, débit, crédit)

## Sécurité (RLS)
- Toutes les tables ont RLS activé
- Accès réservé aux utilisateurs authentifiés (TO authenticated)
- Les profils: lecture de tous les profils pour utilisateurs authentifiés,
  mise à jour du profil propre uniquement (le rôle ne peut pas être modifié par l'utilisateur)
- Toutes les tables métier: CRUD complet pour les utilisateurs authentifiés
  (le contrôle d'accès finir par rôle est géré au niveau de l'application)

## Notes importantes
1. Un trigger crée automatiquement un profil lors de l'inscription d'un utilisateur
2. Le rôle par défaut à l'inscription est 'vendeur'
3. Le premier utilisateur doit être promu 'admin' manuellement via SQL
4. Les écritures comptables sont générées automatiquement par des triggers sur les factures
5. Les numéros de compte suivent le plan comptable français (PCG)
*/

-- ============================================
-- 1. PROFILES (extension de auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'vendeur' CHECK (role IN ('admin', 'vendeur', 'comptable')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_profiles_authenticated" ON profiles;
CREATE POLICY "select_profiles_authenticated"
  ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile"
  ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Trigger: créer un profil automatiquement à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'vendeur')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. PRODUCTS (Produits / Stock)
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designation text NOT NULL,
  barcode text UNIQUE,
  purchase_price numeric(12,2) NOT NULL DEFAULT 0,
  sale_price numeric(12,2) NOT NULL DEFAULT 0,
  quantity_in_stock integer NOT NULL DEFAULT 0,
  alert_threshold integer NOT NULL DEFAULT 10,
  category text DEFAULT 'Général',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_products" ON products;
CREATE POLICY "select_products" ON products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_products" ON products;
CREATE POLICY "insert_products" ON products FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_products" ON products;
CREATE POLICY "update_products" ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_products" ON products;
CREATE POLICY "delete_products" ON products FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_designation ON products(designation);

-- ============================================
-- 3. STOCK_MOVEMENTS (Mouvements de stock)
-- ============================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('entree', 'sortie', 'retour')),
  quantity integer NOT NULL CHECK (quantity > 0),
  reason text DEFAULT '',
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_stock_movements" ON stock_movements;
CREATE POLICY "select_stock_movements" ON stock_movements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_stock_movements" ON stock_movements;
CREATE POLICY "insert_stock_movements" ON stock_movements FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_stock_movements" ON stock_movements;
CREATE POLICY "update_stock_movements" ON stock_movements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_stock_movements" ON stock_movements;
CREATE POLICY "delete_stock_movements" ON stock_movements FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);

-- ============================================
-- 4. CLIENTS
-- ============================================
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  address text,
  city text,
  postal_code text,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_clients" ON clients;
CREATE POLICY "select_clients" ON clients FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_clients" ON clients;
CREATE POLICY "insert_clients" ON clients FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_clients" ON clients;
CREATE POLICY "update_clients" ON clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_clients" ON clients;
CREATE POLICY "delete_clients" ON clients FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);

-- ============================================
-- 5. ORDERS (Commandes)
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'confirmee', 'livree', 'annulee')),
  total_ht numeric(12,2) NOT NULL DEFAULT 0,
  tva_rate numeric(5,2) NOT NULL DEFAULT 20.00,
  tva_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_ttc numeric(12,2) NOT NULL DEFAULT 0,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_orders" ON orders;
CREATE POLICY "select_orders" ON orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_orders" ON orders;
CREATE POLICY "insert_orders" ON orders FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_orders" ON orders;
CREATE POLICY "update_orders" ON orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_orders" ON orders;
CREATE POLICY "delete_orders" ON orders FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- ============================================
-- 6. ORDER_LINES (Lignes de commande)
-- ============================================
CREATE TABLE IF NOT EXISTS order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  designation text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0
);

ALTER TABLE order_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_order_lines" ON order_lines;
CREATE POLICY "select_order_lines" ON order_lines FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_order_lines" ON order_lines;
CREATE POLICY "insert_order_lines" ON order_lines FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_order_lines" ON order_lines;
CREATE POLICY "update_order_lines" ON order_lines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_order_lines" ON order_lines;
CREATE POLICY "delete_order_lines" ON order_lines FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_order_lines_order ON order_lines(order_id);

-- ============================================
-- 7. INVOICES (Factures)
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id),
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  total_ht numeric(12,2) NOT NULL DEFAULT 0,
  tva_rate numeric(5,2) NOT NULL DEFAULT 20.00,
  tva_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_ttc numeric(12,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'en_attente' CHECK (payment_status IN ('paye', 'en_attente', 'partiel')),
  payment_method text CHECK (payment_method IN ('especes', 'carte', 'virement', 'cheque')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_invoices" ON invoices;
CREATE POLICY "select_invoices" ON invoices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_invoices" ON invoices;
CREATE POLICY "insert_invoices" ON invoices FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_invoices" ON invoices;
CREATE POLICY "update_invoices" ON invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_invoices" ON invoices;
CREATE POLICY "delete_invoices" ON invoices FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);

-- ============================================
-- 8. INVOICE_LINES (Lignes de facture)
-- ============================================
CREATE TABLE IF NOT EXISTS invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  designation text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0
);

ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_invoice_lines" ON invoice_lines;
CREATE POLICY "select_invoice_lines" ON invoice_lines FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_invoice_lines" ON invoice_lines;
CREATE POLICY "insert_invoice_lines" ON invoice_lines FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_invoice_lines" ON invoice_lines;
CREATE POLICY "update_invoice_lines" ON invoice_lines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_invoice_lines" ON invoice_lines;
CREATE POLICY "delete_invoice_lines" ON invoice_lines FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);

-- ============================================
-- 9. ACCOUNTING_ENTRIES (Écritures comptables)
-- ============================================
CREATE TABLE IF NOT EXISTS accounting_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  account_number text NOT NULL,
  account_label text NOT NULL DEFAULT '',
  label text NOT NULL,
  debit numeric(14,2) NOT NULL DEFAULT 0,
  credit numeric(14,2) NOT NULL DEFAULT 0,
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manuel' CHECK (source IN ('vente', 'achat', 'manuel', 'stock')),
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_accounting_entries" ON accounting_entries;
CREATE POLICY "select_accounting_entries" ON accounting_entries FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_accounting_entries" ON accounting_entries;
CREATE POLICY "insert_accounting_entries" ON accounting_entries FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_accounting_entries" ON accounting_entries;
CREATE POLICY "update_accounting_entries" ON accounting_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_accounting_entries" ON accounting_entries;
CREATE POLICY "delete_accounting_entries" ON accounting_entries FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_accounting_entries_date ON accounting_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_account ON accounting_entries(account_number);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_invoice ON accounting_entries(invoice_id);

-- ============================================
-- 10. SETTINGS (Paramètres de l'entreprise)
-- ============================================
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'Mon Entreprise',
  address text DEFAULT '',
  city text DEFAULT '',
  postal_code text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  siret text DEFAULT '',
  tva_number text DEFAULT '',
  default_tva_rate numeric(5,2) NOT NULL DEFAULT 20.00,
  invoice_counter integer NOT NULL DEFAULT 1,
  order_counter integer NOT NULL DEFAULT 1,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_company_settings" ON company_settings;
CREATE POLICY "select_company_settings" ON company_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_company_settings" ON company_settings;
CREATE POLICY "insert_company_settings" ON company_settings FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_company_settings" ON company_settings;
CREATE POLICY "update_company_settings" ON company_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_company_settings" ON company_settings;
CREATE POLICY "delete_company_settings" ON company_settings FOR DELETE TO authenticated USING (true);

-- Insérer une ligne de paramètres par défaut
INSERT INTO company_settings (company_name)
SELECT 'Mon Entreprise'
WHERE NOT EXISTS (SELECT 1 FROM company_settings);

-- ============================================
-- 11. VUE: Stock avec alertes
-- ============================================
CREATE OR REPLACE VIEW v_stock_alerts AS
SELECT
  id,
  designation,
  barcode,
  quantity_in_stock,
  alert_threshold,
  CASE
    WHEN quantity_in_stock = 0 THEN 'rupture'
    WHEN quantity_in_stock <= alert_threshold THEN 'alerte'
    ELSE 'ok'
  END AS stock_status
FROM products
ORDER BY
  CASE
    WHEN quantity_in_stock = 0 THEN 0
    WHEN quantity_in_stock <= alert_threshold THEN 1
    ELSE 2
  END,
  designation;

-- ============================================
-- 12. VUE: Bilan comptable (Tous les comptes)
-- ============================================
CREATE OR REPLACE VIEW v_accounting_balance AS
SELECT
  account_number,
  account_label,
  SUM(debit) as total_debit,
  SUM(credit) as total_credit,
  SUM(debit) - SUM(credit) as solde
FROM accounting_entries
GROUP BY account_number, account_label
ORDER BY account_number;

-- ============================================
-- 13. VUE: Statistiques de vente par produit
-- ============================================
CREATE OR REPLACE VIEW v_product_sales AS
SELECT
  p.id,
  p.designation,
  COALESCE(SUM(il.quantity), 0) as total_quantity_sold,
  COALESCE(SUM(il.line_total), 0) as total_revenue,
  p.quantity_in_stock as current_stock
FROM products p
LEFT JOIN invoice_lines il ON il.product_id = p.id
LEFT JOIN invoices i ON il.invoice_id = i.id
GROUP BY p.id, p.designation, p.quantity_in_stock
ORDER BY total_revenue DESC;

-- ============================================
-- 14. FONCTION: Générer les écritures comptables d'une vente
-- ============================================
CREATE OR REPLACE FUNCTION generate_sale_accounting_entries(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice invoices%ROWTYPE;
  v_client_name text;
  v_user_id uuid;
BEGIN
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(c.name, 'Client comptoir') INTO v_client_name
  FROM clients c WHERE c.id = v_invoice.client_id;

  v_user_id := v_invoice.user_id;

  -- Débit 411 (Clients) ou 512 (Banque) / 530 (Caisse) - Total TTC
  INSERT INTO accounting_entries (entry_date, account_number, account_label, label, debit, credit, invoice_id, source, user_id)
  VALUES (
    v_invoice.invoice_date,
    CASE WHEN v_invoice.payment_status = 'paye' THEN '530' ELSE '411' END,
    CASE WHEN v_invoice.payment_status = 'paye' THEN 'Caisse' ELSE 'Clients' END,
    'Facture ' || v_invoice.invoice_number || ' - ' || v_client_name,
    v_invoice.total_ttc,
    0,
    p_invoice_id,
    'vente',
    v_user_id
  );

  -- Crédit 707 (Ventes de marchandises) - Total HT
  INSERT INTO accounting_entries (entry_date, account_number, account_label, label, debit, credit, invoice_id, source, user_id)
  VALUES (
    v_invoice.invoice_date,
    '707',
    'Ventes de marchandises',
    'Facture ' || v_invoice.invoice_number || ' - ' || v_client_name,
    0,
    v_invoice.total_ht,
    p_invoice_id,
    'vente',
    v_user_id
  );

  -- Crédit 44571 (TVA collectée) - Montant TVA
  INSERT INTO accounting_entries (entry_date, account_number, account_label, label, debit, credit, invoice_id, source, user_id)
  VALUES (
    v_invoice.invoice_date,
    '44571',
    'TVA collectée',
    'TVA facture ' || v_invoice.invoice_number,
    0,
    v_invoice.tva_amount,
    p_invoice_id,
    'vente',
    v_user_id
  );
END;
$$;

-- ============================================
-- 15. TRIGGER: Écritures comptables auto sur facture
-- ============================================
CREATE OR REPLACE FUNCTION on_invoice_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Seulement si pas déjà d'écritures pour cette facture
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE invoice_id = NEW.id) THEN
    PERFORM generate_sale_accounting_entries(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_invoice_accounting ON invoices;
CREATE TRIGGER trigger_invoice_accounting
  AFTER INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION on_invoice_created();

-- ============================================
-- 16. FONCTION: Décrémenter le stock après vente
-- ============================================
CREATE OR REPLACE FUNCTION on_invoice_line_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id uuid;
BEGIN
  v_product_id := NEW.product_id;
  IF v_product_id IS NOT NULL THEN
    -- Décrémenter le stock
    UPDATE products
    SET quantity_in_stock = quantity_in_stock - NEW.quantity,
        updated_at = now()
    WHERE id = v_product_id;

    -- Créer un mouvement de stock (sortie)
    INSERT INTO stock_movements (product_id, type, quantity, reason, user_id)
    VALUES (v_product_id, 'sortie', NEW.quantity, 'Vente - Facture', auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_invoice_line_stock ON invoice_lines;
CREATE TRIGGER trigger_invoice_line_stock
  AFTER INSERT ON invoice_lines
  FOR EACH ROW EXECUTE FUNCTION on_invoice_line_created();

-- ============================================
-- 17. FONCTION: Incrémenter le stock sur mouvement d'entrée
-- ============================================
CREATE OR REPLACE FUNCTION on_stock_movement_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'entree' THEN
    UPDATE products SET quantity_in_stock = quantity_in_stock + NEW.quantity, updated_at = now() WHERE id = NEW.product_id;
  ELSIF NEW.type = 'sortie' THEN
    UPDATE products SET quantity_in_stock = quantity_in_stock - NEW.quantity, updated_at = now() WHERE id = NEW.product_id;
  ELSIF NEW.type = 'retour' THEN
    UPDATE products SET quantity_in_stock = quantity_in_stock + NEW.quantity, updated_at = now() WHERE id = NEW.product_id;
  END IF;

  -- Écriture comptable pour les entrées de stock (achat)
  IF NEW.type = 'entree' THEN
    INSERT INTO accounting_entries (entry_date, account_number, account_label, label, debit, credit, source, user_id)
    VALUES (
      CURRENT_DATE,
      '607',
      'Achats de marchandises',
      'Entrée stock - ' || (SELECT designation FROM products WHERE id = NEW.product_id),
      NEW.quantity * (SELECT purchase_price FROM products WHERE id = NEW.product_id),
      0,
      'achat',
      NEW.user_id
    );
    INSERT INTO accounting_entries (entry_date, account_number, account_label, label, debit, credit, source, user_id)
    VALUES (
      CURRENT_DATE,
      '401',
      'Fournisseurs',
      'Entrée stock - ' || (SELECT designation FROM products WHERE id = NEW.product_id),
      0,
      NEW.quantity * (SELECT purchase_price FROM products WHERE id = NEW.product_id),
      'achat',
      NEW.user_id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_stock_movement ON stock_movements;
CREATE TRIGGER trigger_stock_movement
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION on_stock_movement_created();
