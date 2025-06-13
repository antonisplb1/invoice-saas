-- 002_create_customers_and_link.sql

-- 1) Create the customers table
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  merchant_id INTEGER NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,
  first_name VARCHAR NOT NULL,
  last_name  VARCHAR NOT NULL,
  email      VARCHAR NOT NULL UNIQUE,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2) Add customer_id to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS customer_id INTEGER
    REFERENCES customers(id)
    ON DELETE SET NULL;
