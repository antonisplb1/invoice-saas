from pydantic import BaseModel, EmailStr
from datetime import datetime

class CustomerOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: EmailStr
    created_at: datetime
    has_active_invoices: bool  # <-- Add this new field

    class Config:
        from_attributes = True # Use this instead of orm_mode for Pydantic v2