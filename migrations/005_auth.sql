-- Auth: extend existing users table + add rate change requests

-- Add columns to existing users table (safe — uses IF NOT EXISTS)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Update role default to 'staff' (was 'user')
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'staff';

-- Add role constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'users' AND constraint_name = 'users_role_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('staff', 'manager', 'admin'));
  END IF;
END$$;

-- Update any legacy 'user' roles to 'staff'
UPDATE users SET role = 'staff' WHERE role = 'user';

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Rate change requests table
CREATE TABLE IF NOT EXISTS rate_change_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rate_key TEXT NOT NULL,
  rate_label TEXT NOT NULL,
  current_value NUMERIC NOT NULL,
  requested_value NUMERIC NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rcr_status ON rate_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_rcr_requested_by ON rate_change_requests(requested_by);
