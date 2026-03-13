CREATE TABLE IF NOT EXISTS email_failures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  stage TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  message TEXT NOT NULL,
  details TEXT,
  context JSONB DEFAULT '{}'
);
