from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import exists, and_, or_, select
from typing import List, Optional

from app.db.database import get_db
from app.models.customer import Customer
from app.models.invoice import Invoice
from app.models.user import User
from app.api.auth import get_current_user

from app.schemas.invoice import InvoiceOut
from app.schemas.customer import CustomerOut, CustomerUpdate

router = APIRouter(prefix="/customers", tags=["customers"])


def _compute_has_active_invoices(db: Session, merchant_id: int, customer_id: int) -> bool:
    return db.query(
        exists().where(
            and_(
                Invoice.customer_id == customer_id,
                Invoice.merchant_id == merchant_id,
                or_(
                    Invoice.status == 'Due',
                    Invoice.is_recurring == True
                )
            )
        )
    ).scalar()


@router.get("/", response_model=List[CustomerOut])
def get_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    is_active: Optional[bool] = None
):
    """
    Gets all customers. Can be filtered by their active status.
    An active customer has at least one invoice that is 'Due' OR is recurring.
    """
    query = db.query(Customer).filter(Customer.merchant_id == current_user.id)

    if is_active is not None:
        # Correlated subquery for active customers (scoped to this merchant)
        active_customer_subquery = select(Invoice.customer_id).where(
            and_(
                Invoice.customer_id == Customer.id,
                Invoice.merchant_id == current_user.id,
                or_(
                    Invoice.status == 'Due',
                    Invoice.is_recurring == True
                )
            )
        ).distinct()

        if is_active:
            query = query.filter(exists(active_customer_subquery))
        else:
            query = query.filter(~exists(active_customer_subquery))

    customers = query.all()

    # Attach flag used by CustomerOut
    for customer in customers:
        if is_active is not None:
            customer.has_active_invoices = is_active
        else:
            customer.has_active_invoices = _compute_has_active_invoices(
                db, current_user.id, customer.id
            )

    return customers


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.merchant_id == current_user.id
    ).first()

    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    customer.has_active_invoices = _compute_has_active_invoices(
        db, current_user.id, customer.id
    )
    return customer


@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update customer fields (e.g., phone). Only allows updating the current user's customers.
    """
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.merchant_id == current_user.id
    ).first()

    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    # Apply partial updates
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(customer, field, value)

    db.commit()
    db.refresh(customer)

    # Recompute the flag for response
    customer.has_active_invoices = _compute_has_active_invoices(
        db, current_user.id, customer.id
    )
    return customer


@router.get("/{customer_id}/invoices", response_model=List[InvoiceOut])
def get_customer_invoices(
    customer_id: int,
    status: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Invoice).filter(
        Invoice.customer_id == customer_id,
        Invoice.merchant_id == current_user.id
    )

    if status:
        query = query.filter(Invoice.status == status.capitalize())

    invoices = query.all()
    return invoices
