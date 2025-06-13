from datetime import date, datetime
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.invoice import Invoice
from app.models.user import User
import stripe
import os
from dotenv import load_dotenv
from app.utils.send_email import send_invoice_email  # Import the email utility

# Load environment (to pick up STRIPE_SECRET_KEY, DOMAIN, etc.)
load_dotenv()
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")


def generate_recurring_invoices():
    """
    This function finds all base invoices marked is_recurring = True,
    whose next billing date has arrived, and for each:
      1) Updates the base invoice with a new amount, Issue date, status, etc.
      2) Creates a new Stripe Checkout Session.
      3) Sends an email notification to the customer.
      4) Updates last_generated_on on the invoice to today().
    """
    db: Session = SessionLocal()
    today = date.today()

    try:
        # ─── 1) Find all base invoices needing a new recurrence ─────────────────
        bases = (
            db.query(Invoice)
            .filter(Invoice.is_recurring == True)
            .filter(
                ((Invoice.last_generated_on.is_(None)) & (Invoice.recurrence_start_date <= today))
                |
                ((Invoice.last_generated_on.isnot(None)) & (Invoice.last_generated_on < today))
            )
            .all()
        )

        for base in bases:
            # ─── 2) Compute the next issue_date based on frequency ─────────────────
            if base.frequency == "monthly":
                next_due = date(today.year, today.month, 1)
            elif base.frequency == "yearly":
                if (
                    base.last_generated_on is None
                    and base.recurrence_start_date.year == today.year
                    and today >= date(today.year, 1, 1)
                ):
                    next_due = date(today.year, 1, 1)
                else:
                    next_due = date(today.year + 1, 1, 1)
            else:
                print(f"⚠️ Skipping invoice {base.id}: unrecognized frequency '{base.frequency}'")
                continue

            # Skip if not yet time
            if next_due > today:
                continue

            # ─── 3) Update the base invoice instead of cloning ──────────────────
            base.status = "Due"
            base.amount = base.recurring_amount if base.recurring_amount is not None else base.amount
            base.issue_date = next_due
            base.payment_url = None  # Reset old URL to prepare for new one

            db.commit()
            db.refresh(base)

            # ─── 4) Create a Stripe Checkout Session ────────────────────────────
            try:
                base_user = db.query(User).filter(User.id == base.merchant_id).first()
                if not base_user or not base_user.stripe_account_id:
                    print(f"⚠️ Base invoice {base.id} has no connected Stripe account; skipping Checkout session creation.")
                else:
                    session = stripe.checkout.Session.create(
                        payment_method_types=["card"],
                        line_items=[{
                            "price_data": {
                                "currency": "usd",
                                "product_data": {
                                    "name": f"Invoice #{base.id} for {base.customer_first_name} {base.customer_last_name}"
                                },
                                "unit_amount": int(base.amount * 100),
                            },
                            "quantity": 1,
                        }],
                        mode="payment",
                        success_url=f"{os.getenv('DOMAIN')}/payment-success?session_id={{CHECKOUT_SESSION_ID}}",
                        cancel_url=f"{os.getenv('DOMAIN')}/payment-cancel",
                        metadata={"invoice_id": str(base.id)},
                        payment_intent_data={
                            "transfer_data": {
                                "destination": base_user.stripe_account_id
                            }
                        },
                    )
                    base.payment_url = session.url
                    db.commit()
                    print(f"✅ Updated recurring invoice {base.id} with new Checkout URL.")

                    # ─── 5) Send Email Notification ─────────────────────────────
                    subject = f"Your Recurring Invoice #{base.id} from {base_user.company_name}"
                    content = f"""
                    <html>
                    <body>
                        <p>Dear {base.customer_first_name},</p>
                        <p>You have a new recurring invoice from {base_user.company_name}.</p>
                        <p>Amount: €{base.amount}</p>
                        <p>Issue Date: {base.issue_date}</p>
                        <p><a href="{base.payment_url}">Click here to pay your invoice</a></p>
                    </body>
                    </html>
                    """
                    send_invoice_email(base.customer_email, subject, content)

            except stripe.error.StripeError as e:
                print(f"❌ Stripe error creating session for invoice {base.id}: {str(e)}")

            # ─── 6) Update last_generated_on on the base invoice ────────────────
            base.last_generated_on = today
            db.commit()
            print(f"⏱ Updated base invoice {base.id} last_generated_on = {today}")

    except Exception as ex:
        print(f"🔥 Error in generate_recurring_invoices: {str(ex)}")
    finally:
        db.close()


def start_scheduler():
    """
    Initializes and starts APScheduler jobs:
      • Monthly job at 00:00 on day 1 of each month
      • Yearly job at 00:00 on January 1
    """
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger

    scheduler = BackgroundScheduler(timezone="UTC")

    scheduler.add_job(
        generate_recurring_invoices,
        trigger=CronTrigger(day="1", hour="0", minute="0"),
        id="monthly_recurring_job",
        replace_existing=True
    )
    scheduler.add_job(
        generate_recurring_invoices,
        trigger=CronTrigger(month="1", day="1", hour="0", minute="0"),
        id="yearly_recurring_job",
        replace_existing=True
    )

    scheduler.start()
    print("⏲ APScheduler started: monthly and yearly recurring jobs scheduled.")
