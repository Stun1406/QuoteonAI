-- Enhance companies table with CRM fields
ALTER TABLE companies ADD COLUMN IF NOT EXISTS industry_type TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'standard';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS credit_terms TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS notes TEXT;

-- CRM carriers
CREATE TABLE IF NOT EXISTS crm_carriers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_name    TEXT NOT NULL,
  mc_number       TEXT,
  dot_number      TEXT,
  contact_name    TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  insurance_status TEXT DEFAULT 'active',
  insurance_expiry DATE,
  performance_score DECIMAL(3,1) DEFAULT 5.0,
  status          TEXT DEFAULT 'active',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_carriers_tenant ON crm_carriers(tenant_id);
CREATE TRIGGER update_crm_carriers_updated_at
  BEFORE UPDATE ON crm_carriers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- CRM shipments
CREATE TABLE IF NOT EXISTS crm_shipments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bol_number       TEXT,
  company_id       UUID REFERENCES companies(id),
  carrier_id       UUID REFERENCES crm_carriers(id),
  customer_name    TEXT,
  origin           TEXT,
  destination      TEXT,
  equipment_type   TEXT,
  service_type     TEXT,
  pickup_date      DATE,
  delivery_date    DATE,
  actual_pickup    DATE,
  actual_delivery  DATE,
  status           TEXT DEFAULT 'pending',
  quote_value      DECIMAL(10,2),
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_shipments_tenant ON crm_shipments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_shipments_company ON crm_shipments(company_id);
CREATE TRIGGER update_crm_shipments_updated_at
  BEFORE UPDATE ON crm_shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
