# app/api/stripe_connect.py

from fastapi import APIRouter, Depends, HTTPException, Query, Security
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from urllib.parse import urlencode
import requests

from app.core.config import settings
from app.db.database import get_db
from app.models.user import User
from app.api.dependencies import get_current_user

router = APIRouter(tags=["Stripe Connect"])

# ✅ Auth scheme declaration for Swagger UI to behave
bearer_scheme = HTTPBearer()

# ✅ 1. Generate Stripe Connect URL (now marked with security explicitly)
@router.get("/connect-stripe-account", summary="Generate Stripe Connect URL")
def connect_stripe_account(
    current_user: User = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme)
):
    params = {
        "response_type": "code",
        "client_id": settings.STRIPE_CLIENT_ID,
        "scope": "read_write",
        "redirect_uri": settings.STRIPE_REDIRECT_URI,
        "state": str(current_user.id)
    }
    url = f"https://connect.stripe.com/oauth/authorize?{urlencode(params)}"
    return {"url": url}

# ✅ 2. Public callback handler (unchanged)
@router.get("/oauth/callback", summary="Stripe OAuth callback", response_class=HTMLResponse)
def stripe_oauth_callback(
    code: str = Query(...),
    state: int = Query(...),
    error: str = Query(None),
    db: Session = Depends(get_db)
):
    print("📥 Stripe callback HIT")
    print(f"🔧 code={code}, state={state}, error={error}")

    if error:
        return HTMLResponse(
            content=f"<h2>❌ Stripe error: {error}</h2>",
            status_code=400
        )

    data = {
        "client_secret": settings.STRIPE_SECRET_KEY,
        "code": code,
        "grant_type": "authorization_code",
    }

    try:
        response = requests.post("https://connect.stripe.com/oauth/token", data=data)
        response.raise_for_status()
        stripe_data = response.json()
        print(f"✅ Stripe token exchange success: {stripe_data}")
    except requests.RequestException as e:
        return HTMLResponse(
            content=f"<h2>❌ OAuth token exchange failed: {str(e)}</h2>",
            status_code=400
        )

    stripe_user_id = stripe_data.get("stripe_user_id")
    if not stripe_user_id:
        return HTMLResponse(
            content="<h2>❌ Stripe user ID not returned</h2>",
            status_code=400
        )

    user = db.query(User).filter(User.id == state).first()
    if not user:
        return HTMLResponse(
            content="<h2>❌ User not found</h2>",
            status_code=404
        )

    user.stripe_account_id = stripe_user_id
    db.commit()

    return HTMLResponse(
        content=f"<h2>✅ Stripe account connected successfully for {user.email}!</h2><p>You can now close this window.</p>",
        status_code=200
    )
