import os
from dotenv import load_dotenv
import stripe

# ✅ Load .env file
load_dotenv()

# ✅ Check if env variable was loaded
print("Loaded Stripe Key:", os.getenv("STRIPE_SECRET_KEY"))  # 👈 this must print the full key

# ✅ Set the Stripe key
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

if not stripe.api_key or "sk_test_" not in stripe.api_key:
    raise Exception("❌ Stripe secret key is missing or invalid in .env")

# ✅ Create a test Stripe checkout session
session = stripe.checkout.Session.create(
    payment_method_types=["card"],
    mode="payment",
    line_items=[{
        "price_data": {
            "currency": "usd",
            "unit_amount": 1000,
            "product_data": {
                "name": "Test Invoice"
            }
        },
        "quantity": 1,
    }],
    success_url="https://example.com/success",
    cancel_url="https://example.com/cancel",
    metadata={
        "invoice_id": "9999"
    }
)

print("✅ Created session. URL:")
print(session.url)
