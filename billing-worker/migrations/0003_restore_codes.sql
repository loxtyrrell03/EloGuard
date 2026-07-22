CREATE TABLE IF NOT EXISTS restore_codes (
  email TEXT NOT NULL,
  install_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (email, install_id)
);
