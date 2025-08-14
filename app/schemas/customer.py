from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

class CustomerOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None            # ← NEW
    created_at: datetime
    has_active_invoices: bool

    class Config:
        from_attributes = True

# For editing a customer (e.g., phone)
class CustomerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None            # ← NEW
