CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  phone TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
