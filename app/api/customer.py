from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import exists, and_, or_, select
from typing import List, Optional

from app.db.database import get_db
from app.models.customer import Customer
from app.models.invoice import Invoice
from app.models.user import User
from app.schemas.customer import CustomerOut
from app.api.auth import get_current_user
from app.schemas.invoice import InvoiceOut

router = APIRouter(prefix="/customers", tags=["customers"])

@router.get("/", response_model=List[CustomerOut])
def get_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    is_active: Optional[bool] = None  # <-- New optional filter parameter
):
    """
    Gets all customers. Can be filtered by their active status.
    An active customer has at least one invoice that is 'Due' OR is recurring.
    """
    query = db.query(Customer).filter(Customer.merchant_id == current_user.id)

    # If a filter is provided, modify the query
    if is_active is not None:
        # Subquery to find the IDs of all customers who have active invoices
        active_customer_subquery = select(Invoice.customer_id).where(
            and_(
                Invoice.customer_id == Customer.id, # Correlated subquery
                Invoice.merchant_id == current_user.id,
                or_(
                    Invoice.status == 'Due',
                    Invoice.is_recurring == True
                )
            )
        ).distinct()

        if is_active:
            # Filter for customers who are in the active list
            query = query.filter(exists(active_customer_subquery))
        else:
            # Filter for customers who are NOT in the active list
            query = query.filter(~exists(active_customer_subquery))

    customers = query.all()

    # Augment the final list of customers with the 'has_active_invoices' flag
    for customer in customers:
        if is_active is not None:
            # If we filtered, we already know the status
            customer.has_active_invoices = is_active
        else:
            # If we didn't filter, we still need to calculate it for each one
            customer.has_active_invoices = db.query(
                exists().where(
                    and_(
                        Invoice.customer_id == customer.id,
                        or_(
                            Invoice.status == 'Due',
                            Invoice.is_recurring == True
                        )
                    )
                )
            ).scalar()
            
    return customers


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