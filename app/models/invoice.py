# invoice_saas/app/models/invoice.py

from sqlalchemy import Column, Integer, String, Date, Float, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app.db.database import Base

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    merchant_id          = Column(Integer, ForeignKey("users.id"))
    customer_first_name  = Column(String, nullable=False)
    customer_last_name   = Column(String, nullable=False)
    customer_email       = Column(String, nullable=False)
    amount               = Column(Float, nullable=False)
    issue_date             = Column(Date, nullable=False)
    frequency            = Column(String, nullable=True)
    status               = Column(String, default="Due")
    notes                = Column(Text, nullable=True)
    payment_url          = Column(String, nullable=True)

    # ─── Recurring fields (added via migration) ─────────────────────────────────
    is_recurring         = Column(Boolean, nullable=False, default=False)
    recurring_amount     = Column(Float, nullable=True)
    recurrence_start_date = Column(Date, nullable=True)
    original_invoice_id  = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    last_generated_on    = Column(Date, nullable=True)

    merchant = relationship("User", back_populates="invoices")
    # ─── Link to Customer ─────────────────────────────────────────────────────
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    customer    = relationship("Customer", back_populates="invoices")

    # (Self-ref for recurring origin)    
