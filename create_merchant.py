import os
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.user import User
from app.core.security import hash_password

load_dotenv()

from app.db.database import Base, engine
from app.models import user, invoice, customer

# Create tables if not exist
Base.metadata.create_all(bind=engine)


def create_user():
    db: Session = SessionLocal()
    email = input("Merchant email: ")
    password = input("Password: ")
    company = input("Company name: ")

    hashed = hash_password(password)
    user = User(email=email, company_name=company, hashed_password=hashed)
    db.add(user)
    db.commit()
    print("Merchant created.")

if __name__ == "__main__":
    create_user()
