# invoice_saas/app/main.py

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from fastapi.staticfiles import StaticFiles

from app.api import auth, invoice, webhook, stripe_connect
from app.api.webhook import router as webhook_router
from app.db.database import Base, engine
from app.tasks.recurrence import start_scheduler
from app.api.customer import router as customer_router

security = HTTPBearer()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Debug Webhook ──────────────────────────────────────────────────────────
@app.post("/debug-webhook")
async def debug_webhook(request: Request):
    body = await request.body()
    print("📥 RAW WEBHOOK:")
    print(body.decode("utf-8"))
    return {"ok": True}

# ─── On Startup: Create Tables and Start Recurring Jobs ─────────────────────
@app.on_event("startup")
async def on_startup():
    Base.metadata.create_all(bind=engine)
    start_scheduler()

# ─── Existing Public Routes ─────────────────────────────────────────────────
app.include_router(invoice.router)
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(webhook.router, tags=["Stripe Webhook"])
app.include_router(webhook_router)
app.include_router(customer_router)

# ─── Existing Protected Routes ───────────────────────────────────────────────
app.include_router(
    invoice.router,
    prefix="/invoices",
    tags=["Invoices"],
    dependencies=[Depends(security)]
)

# ─── Stripe Connect (no auth) ────────────────────────────────────────────────
app.include_router(stripe_connect.router, prefix="/stripe")

# ─── Payment Redirect Endpoints ──────────────────────────────────────────────
@app.get("/payment-success")
async def payment_success(session_id: str):
    """
    Stripe will redirect customers here after successful payment.
    We simply return a JSON confirmation for now. 
    """
    return {
        "message": "Payment succeeded!",
        "checkout_session_id": session_id
    }

@app.get("/payment-cancel")
async def payment_cancel():
    """
    Stripe will redirect customers here if they cancel out of Checkout.
    """
    return {"message": "Payment was canceled."}

# ─── Serve Frontend Static Files ────────────────────────────────────────────
app.mount("/app", StaticFiles(directory="frontend", html=True), name="frontend")
