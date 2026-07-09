CREATE TABLE IF NOT EXISTS installations (
  install_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT NOT NULL DEFAULT '',
  stripe_subscription_id TEXT NOT NULL DEFAULT '',
  stripe_payment_intent_id TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  current_period_end TEXT NOT NULL DEFAULT '',
  access_until TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_installations (
  customer_id TEXT PRIMARY KEY,
  install_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscription_installations (
  subscription_id TEXT PRIMARY KEY,
  install_id TEXT NOT NULL
);
