-- 001_add_recurring_fields.sql
ALTER TABLE invoices
  ADD COLUMN is_recurring         BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN recurring_amount     DOUBLE PRECISION NULL,
  ADD COLUMN recurrence_start_date DATE     NULL,
  ADD COLUMN original_invoice_id   INTEGER  NULL REFERENCES invoices(id),
  ADD COLUMN last_generated_on     DATE     NULL;
