# app/api/webhook.py

from fastapi import APIRouter, Request, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.invoice import Invoice
import stripe
import os
from dotenv import load_dotenv

load_dotenv()
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

router = APIRouter()

@router.post("/stripe-webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=os.getenv("STRIPE_WEBHOOK_SECRET"),
        )
    except Exception as e:
        print("🔥 Webhook signature verification failed:", str(e))
        return {"success": False, "error": str(e)}

    # ─── Log the full event and its data ───────────────────────────────────
    print("🔔 Received Stripe event:", event["type"])
    print("🪪 Raw event data object:", event["data"]["object"])

    if event["type"] == "checkout.session.completed":
        session_obj = event["data"]["object"]
        print("💡 session_obj.metadata in webhook:", session_obj.get("metadata"))

        invoice_id = session_obj.get("metadata", {}).get("invoice_id")
        if not invoice_id:
            print("⚠️ Metadata missing invoice_id; cannot update.")
        else:
            invoice = db.query(Invoice).filter(Invoice.id == int(invoice_id)).first()
            if not invoice:
                print(f"⚠️ Invoice {invoice_id} wasn’t found in the DB")
            else:
                invoice.status = "Paid"
                db.commit()
                print(f"✅ Invoice {invoice_id} marked as Paid in DB")

    else:
        print(f"⏭️ Ignoring unhandled event type: {event['type']}")

    return {"success": True}
