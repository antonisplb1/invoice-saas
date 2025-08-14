# invoice_saas/app/models/customer.py

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint # 1. Import UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base

class Customer(Base):
    __tablename__ = "customers"

    id          = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    first_name  = Column(String, nullable=False)
    last_name   = Column(String, nullable=False)
    email       = Column(String, nullable=False, index=True) # 2. unique=True REMOVED
    created_at  = Column(DateTime, nullable=False, default=datetime.utcnow)
    phone       = Column(String, nullable=True)

    merchant    = relationship("User", back_populates="customers")
    invoices    = relationship("Invoice", back_populates="customer")

    # 3. ADD THIS NEW PROPERTY
    __table_args__ = (
        UniqueConstraint('email', 'merchant_id', name='_customer_email_merchant_uc'),
    )