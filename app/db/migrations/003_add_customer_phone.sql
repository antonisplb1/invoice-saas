-- 003_add_customer_phone.sql
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS phone VARCHAR;
