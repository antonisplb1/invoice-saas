# invoice_saas/app/schemas/invoice.py

from pydantic import BaseModel, EmailStr
from datetime import date
from typing import Optional

class InvoiceCreate(BaseModel):
    # ─── Core invoice fields ───────────────────────────────────────────────────
    customer_first_name: str
    customer_last_name: str
    customer_email: EmailStr
    amount: float
    issue_date: date
    frequency: Optional[str] = None
    notes: Optional[str] = None

    # ─── Recurrence fields (new) ───────────────────────────────────────────────
    is_recurring: Optional[bool] = False
    recurring_amount: Optional[float] = None
    recurrence_start_date: Optional[date] = None
    original_invoice_id: Optional[int] = None

    class Config:
        schema_extra = {
            "example": {
                "customer_first_name": "Anto",
                "customer_last_name":  "Nis",
                "customer_email":      "user@example.com",
                "amount":              4.00,
                "issue_date":            "2025-06-05",
                "frequency":           "monthly",
                "notes":               "month upfront",
                "is_recurring":        True,
                "recurring_amount":    4.00,
                "recurrence_start_date": "2025-06-05",
                "original_invoice_id":  None
            }
        }

class InvoiceOut(InvoiceCreate):
    id: int
    status: str
    payment_url: Optional[str] = None

    class Config:
        orm_mode = True

class RecurringAmountUpdate(BaseModel):
    recurring_amount: float

    class Config:
        schema_extra = {
            "example": {
                "recurring_amount": 9.99
            }
        }