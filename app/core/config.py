import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    DATABASE_URL = os.getenv("DATABASE_URL")
    STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
    STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
    STRIPE_CLIENT_ID = os.getenv("STRIPE_CLIENT_ID")
    STRIPE_REDIRECT_URI = os.getenv("STRIPE_REDIRECT_URI")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback-secret")

    # 🔑 Alias to support both JWT_SECRET_KEY and SECRET_KEY usage
    SECRET_KEY = JWT_SECRET_KEY
    ALGORITHM = "HS256"

settings = Settings()
