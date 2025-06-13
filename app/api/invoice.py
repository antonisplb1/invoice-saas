from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.invoice import Invoice
from app.models.customer import Customer
from app.schemas.invoice import InvoiceCreate, InvoiceOut, RecurringAmountUpdate
from app.models.user import User
from app.api.dependencies import get_current_user
import stripe
import os
from dotenv import load_dotenv
from datetime import date
from typing import List
from app.utils.send_email import send_invoice_email

load_dotenv()
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

router = APIRouter()

def first_of_next_month(d: date) -> date:
    if d.month == 12:
        return date(d.year + 1, 1, 1)
    return date(d.year, d.month + 1, 1)

def first_of_next_year(d: date) -> date:
    return date(d.year + 1, 1, 1)

@router.post("/", response_model=InvoiceOut)
def create_invoice(
    invoice: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = invoice.dict()
    payload["merchant_id"] = current_user.id

    existing_customer = (
        db.query(Customer)
        .filter_by(email=payload["customer_email"], merchant_id=current_user.id)
        .first()
    )

    if payload.get("is_recurring"):
        if existing_customer:
            # 🚨 New logic: Check if existing customer has an active recurring invoice
            existing_recurring_invoice = (
                db.query(Invoice)
                .filter_by(
                    customer_id=existing_customer.id,
                    merchant_id=current_user.id,
                    is_recurring=True
                )
                .first()
            )
            if existing_recurring_invoice:
                raise HTTPException(
                    status_code=422,
                    detail=f"Customer with email {payload['customer_email']} already has a recurring invoice."
                )
            payload["customer_id"] = existing_customer.id
        else:
            new_customer = Customer(
                merchant_id=current_user.id,
                first_name=payload["customer_first_name"],
                last_name=payload["customer_last_name"],
                email=payload["customer_email"]
            )
            db.add(new_customer)
            db.commit()
            db.refresh(new_customer)
            payload["customer_id"] = new_customer.id

        if payload.get("recurring_amount") is None:
            raise HTTPException(
                status_code=422,
                detail="If is_recurring is true, you must also provide recurring_amount."
            )
        today = date.today()
        freq = payload.get("frequency", "").lower()
        if freq == "monthly":
            payload["recurrence_start_date"] = first_of_next_month(today)
        elif freq == "yearly":
            payload["recurrence_start_date"] = first_of_next_year(today)
        else:
            raise HTTPException(
                status_code=422,
                detail="If is_recurring is true, frequency must be 'monthly' or 'yearly'."
            )
    else:
        if existing_customer:
            payload["customer_id"] = existing_customer.id
        else:
            new_customer = Customer(
                merchant_id=current_user.id,
                first_name=payload["customer_first_name"],
                last_name=payload["customer_last_name"],
                email=payload["customer_email"]
            )
            db.add(new_customer)
            db.commit()
            db.refresh(new_customer)
            payload["customer_id"] = new_customer.id

        payload["recurring_amount"] = None
        payload["recurrence_start_date"] = None
        payload["original_invoice_id"] = None

    db_invoice = Invoice(**payload)
    db.add(db_invoice)
    db.commit()
    db.refresh(db_invoice)

    base_domain = os.getenv("DOMAIN") or "http://localhost:8000"
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "eur",
                    "product_data": {
                        "name": f"Invoice #{db_invoice.id} for {current_user.company_name}"
                    },
                    "unit_amount": int(db_invoice.amount * 100),
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{base_domain}/payment-success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{base_domain}/payment-cancel",
            metadata={"invoice_id": str(db_invoice.id)},
            payment_intent_data={
                "transfer_data": {
                    "destination": current_user.stripe_account_id
                }
            },
        )
    except stripe.error.StripeError as e:
        db.delete(db_invoice)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Stripe error: {e.user_message or str(e)}")

    db_invoice.payment_url = session.url
    db.commit()
    db.refresh(db_invoice)

    # ─── Send Email Notification ─────────────────────────────────────────────
    subject = f"Your Invoice #{db_invoice.id} from {current_user.company_name}"
    content = f"""
    <html>
    <body>
        <p>Dear {db_invoice.customer_first_name},</p>
        <p>You have a new invoice from {current_user.company_name}.</p>
        <p>Amount: ${db_invoice.amount}</p>
        <p>Issue Date: {db_invoice.due_date}</p>
        <p><a href="{db_invoice.payment_url}">Click here to pay your invoice</a></p>
    </body>
    </html>
    """
    send_invoice_email(db_invoice.customer_email, subject, content)

    return db_invoice

@router.patch("/cancel/{invoice_id}", response_model=InvoiceOut)
def cancel_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = db.query(Invoice).filter_by(id=invoice_id, merchant_id=current_user.id).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found or unauthorized.")

    if invoice.status == "canceled":
        raise HTTPException(status_code=400, detail="Invoice is already canceled.")

    invoice.status = "canceled"
    invoice.is_recurring = False

    if invoice.is_recurring:
        invoice.recurrence_start_date = None

    db.commit()
    db.refresh(invoice)

    return invoice

@router.patch("/{invoice_id}/recurring-amount", response_model=InvoiceOut)
def update_recurring_amount(
    invoice_id: int,
    update: RecurringAmountUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = db.query(Invoice).filter_by(id=invoice_id, merchant_id=current_user.id).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found or unauthorized.")

    if not invoice.is_recurring:
        raise HTTPException(status_code=400, detail="Invoice is not recurring.")

    if update.recurring_amount <= 0:
        raise HTTPException(status_code=400, detail="Recurring amount must be positive.")

    invoice.recurring_amount = update.recurring_amount
    db.commit()
    db.refresh(invoice)

    return invoice

@router.get("/due", response_model=List[InvoiceOut])
def list_due_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    due_invoices = (
        db.query(Invoice)
        .filter_by(merchant_id=current_user.id, status="Due")
        .all()
    )
    return due_invoices

@router.get("/paid", response_model=List[InvoiceOut])
def list_paid_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    paid_invoices = (
        db.query(Invoice)
        .filter_by(merchant_id=current_user.id, status="Paid")
        .all()
    )
    return paid_invoices

@router.get("/canceled", response_model=List[InvoiceOut])
def list_canceled_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    canceled_invoices = (
        db.query(Invoice)
        .filter_by(merchant_id=current_user.id, status="canceled")
        .all()
    )
    return canceled_invoices

@router.get("/all", response_model=List[InvoiceOut])
def list_all_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    all_invoices = (
        db.query(Invoice)
        .filter_by(merchant_id=current_user.id)
        .all()
    )
    return all_invoices

@router.patch("/{invoice_id}/status", response_model=InvoiceOut)
def update_invoice_status(
    invoice_id: int,
    status_update: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_status = status_update.get("status")
    if new_status not in ["Due", "Paid", "canceled"]:
        raise HTTPException(status_code=400, detail="Invalid status")

    invoice = db.query(Invoice).filter_by(id=invoice_id, merchant_id=current_user.id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    prev_status = invoice.status

    if prev_status == new_status:
        return invoice

    if prev_status == "Due" and new_status == "Paid":
        invoice.status = "Paid"
    elif prev_status == "Paid" and new_status == "Due":
        invoice.status = "Due"
    elif prev_status == "canceled" and new_status == "Due":
        invoice.status = "Due"
        if invoice.frequency:
            invoice.is_recurring = True
    elif prev_status == "canceled" and new_status == "Paid":
        invoice.status = "Paid"
        if invoice.frequency:
            invoice.is_recurring = True
    elif new_status == "canceled":
        invoice.status = "canceled"
        invoice.is_recurring = False
    else:
        raise HTTPException(status_code=400, detail="Invalid status transition")

    db.commit()
    db.refresh(invoice)
    return invoice
