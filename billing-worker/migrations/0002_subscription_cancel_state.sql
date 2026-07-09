ALTER TABLE installations ADD COLUMN cancel_at_period_end INTEGER NOT NULL DEFAULT 0;
ALTER TABLE installations ADD COLUMN cancel_at TEXT NOT NULL DEFAULT '';
