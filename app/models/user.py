# app/models/user.py

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.database import Base

class User(Base):
    __tablename__ = "users"

    id                = Column(Integer, primary_key=True, index=True)
    company_name      = Column(String, nullable=False)
    email             = Column(String, unique=True, index=True, nullable=False)
    hashed_password   = Column(String, nullable=False)
    stripe_account_id = Column(String, nullable=True)

    invoices  = relationship("Invoice",  back_populates="merchant")
    customers = relationship("Customer", back_populates="merchant")
