# invoice_saas/app/models/customer.py

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base

class Customer(Base):
    __tablename__ = "customers"

    id          = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    first_name  = Column(String, nullable=False)
    last_name   = Column(String, nullable=False)
    email       = Column(String, nullable=False, unique=True, index=True)
    created_at  = Column(DateTime, nullable=False, default=datetime.utcnow)

    merchant    = relationship("User", back_populates="customers")
    invoices    = relationship("Invoice", back_populates="customer")
