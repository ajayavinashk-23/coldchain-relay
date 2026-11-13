
import os
import time
import uuid

import httpx

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware


from pydantic import BaseModel, Field


from app.rescue_engine import find_compatible_providers
from app.incident_service import analyze_incident
from app.orchestrator import orchestrate_rescue
from app.ai_service import handle_natural_language_incident


# Environment configuration
load_dotenv("backend/.env")

PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID")
PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET")

PAYPAL_BASE_URL = os.getenv(
    "PAYPAL_BASE_URL",
    "https://api-m.sandbox.paypal.com"
)

FRONTEND_ORIGIN = os.getenv(
    "FRONTEND_ORIGIN",
    "http://localhost:5173"

)

# Demo PayPal transaction amount.
# This is separate from the provider's actual INR service cost.
PAYPAL_DEMO_AMOUNT = "24.00"
PAYPAL_DEMO_CURRENCY = "USD"


# FastAPI application
app = FastAPI(
    title="ColdChain Relay API",
    description="AI-powered cold-chain emergency response platform",
    version="0.2.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://coldchain-relay.vercel.app",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# In-memory booking and payment tracking.
# Replace with PostgreSQL when adding persistent storage.
rescue_bookings = {}
created_orders = {}
captured_orders = {}


# PayPal OAuth token cache
_access_token = None
_token_expiry = 0


# Request models
class IncidentRequest(BaseModel):
    product_type: str
    quantity_kg: float = Field(gt=0)
    current_temp: float
    required_temp: float


class RescueRequest(BaseModel):
    product_type: str
    quantity_kg: float = Field(gt=0)
    required_temp: float


class CreateOrderRequest(BaseModel):
    provider_id: str = Field(min_length=1)
    product_type: str
    quantity_kg: float = Field(gt=0)
    required_temp: float

class NaturalLanguageIncidentRequest(BaseModel):
    incident_description: str = Field(min_length=10, max_length=2000)

# General endpoints
@app.get("/")
async def root():
    return {
        "application": "ColdChain Relay",
        "status": "running",
        "environment": "PayPal Sandbox"
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


# PayPal authentication
async def get_access_token():

    global _access_token, _token_expiry

    if not PAYPAL_CLIENT_ID or not PAYPAL_CLIENT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="PayPal credentials are not configured."
        )

    if _access_token and time.time() < _token_expiry:
        return _access_token

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            f"{PAYPAL_BASE_URL}/v1/oauth2/token",
            auth=(
                PAYPAL_CLIENT_ID,
                PAYPAL_CLIENT_SECRET
            ),
            data={
                "grant_type": "client_credentials"
            },
            headers={
                "Accept": "application/json",
                "Accept-Language": "en_US"
            }
        )

    if response.is_error:
        raise HTTPException(
            status_code=502,
            detail=f"PayPal authentication failed: {response.text}"
        )

    data = response.json()

    _access_token = data["access_token"]

    _token_expiry = (
        time.time() + data.get("expires_in", 300) - 60
    )

    return _access_token


# Create a dynamic rescue booking and PayPal order
@app.post("/api/paypal/create-order")
async def create_paypal_order(payload: CreateOrderRequest):

    # Recheck compatible providers on the backend.
    providers = find_compatible_providers(
        product_type=payload.product_type,
        quantity_kg=payload.quantity_kg,
        required_temp=payload.required_temp
    )

    selected_provider = next(
        (
            provider for provider in providers
            if provider["id"] == payload.provider_id
        ),
        None
    )

    if not selected_provider:
        raise HTTPException(
            status_code=400,
            detail="Selected provider is not compatible with this rescue."
        )

    # Generate a unique rescue booking ID.
    rescue_id = f"rescue-{uuid.uuid4().hex[:10]}"

    # Store the actual provider and its INR cost.
    booking = {
        "rescue_id": rescue_id,
        "provider": selected_provider,
        "product_type": payload.product_type,
        "quantity_kg": payload.quantity_kg,
        "required_temp": payload.required_temp,
        "provider_cost": selected_provider["cost"],
        "provider_currency": "INR",
        "paypal_demo_amount": PAYPAL_DEMO_AMOUNT,
        "paypal_demo_currency": PAYPAL_DEMO_CURRENCY
    }

    rescue_bookings[rescue_id] = booking

    token = await get_access_token()

    order_payload = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "reference_id": rescue_id,
                "description": (
                    f"ColdChain Relay demo booking - "
                    f"{selected_provider['name']}"
                ),
                "amount": {
                    "currency_code": PAYPAL_DEMO_CURRENCY,
                    "value": PAYPAL_DEMO_AMOUNT
                }
            }
        ],
        "payment_source": {
            "paypal": {
                "experience_context": {
                    "brand_name": "ColdChain Relay",
                    "return_url": FRONTEND_ORIGIN,
                    "cancel_url": FRONTEND_ORIGIN,
                    "user_action": "CONTINUE",
                    "shipping_preference": "NO_SHIPPING"
                }
            }
        }
    }

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "PayPal-Request-Id": str(uuid.uuid4())
            },
            json=order_payload
        )

    if response.is_error:
        rescue_bookings.pop(rescue_id, None)

        raise HTTPException(
            status_code=502,
            detail=f"PayPal order creation failed: {response.text}"
        )

    order = response.json()

    created_orders[order["id"]] = rescue_id

    return {
        "id": order["id"],
        "status": order["status"],
        "rescue_id": rescue_id,
        "provider": selected_provider,
        "provider_cost": selected_provider["cost"],
        "provider_currency": "INR",
        "paypal_demo_amount": PAYPAL_DEMO_AMOUNT,
        "paypal_demo_currency": PAYPAL_DEMO_CURRENCY
    }


# Capture PayPal payment
@app.post("/api/paypal/capture/{order_id}")
async def capture_paypal_order(order_id: str):

    if order_id in captured_orders:
        return captured_orders[order_id]

    if order_id not in created_orders:
        raise HTTPException(
            status_code=404,
            detail="Unknown or unrecognized order."
        )

    token = await get_access_token()

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}/capture",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "PayPal-Request-Id": f"capture-{order_id}"
            },
            json={}
        )

    if response.is_error:
        raise HTTPException(
            status_code=502,
            detail=f"PayPal capture failed: {response.text}"
        )

    capture_data = response.json()

    if capture_data.get("status") != "COMPLETED":
        raise HTTPException(
            status_code=409,
            detail="Payment capture is not completed."
        )

    rescue_id = created_orders[order_id]
    booking = rescue_bookings[rescue_id]

    result = {
        "status": capture_data["status"],
        "order_id": order_id,
        "rescue_id": rescue_id,
        "provider": booking["provider"],
        "provider_cost": booking["provider_cost"],
        "provider_currency": booking["provider_currency"],
        "paypal_demo_amount": booking["paypal_demo_amount"],
        "paypal_demo_currency": booking["paypal_demo_currency"],
        "payment_details": capture_data.get(
            "purchase_units", []
        )
    }

    captured_orders[order_id] = result

    return result


# Rescue recommendation endpoint
@app.post("/api/rescue/recommend")
async def recommend_rescue(payload: RescueRequest):

    providers = find_compatible_providers(
        product_type=payload.product_type,
        quantity_kg=payload.quantity_kg,
        required_temp=payload.required_temp
    )

    if not providers:
        return {
            "status": "NO_COMPATIBLE_PROVIDER",
            "recommendation": None,
            "alternatives": []
        }

    return {
        "status": "PROVIDERS_FOUND",
        "recommendation": providers[0],
        "alternatives": providers[1:]
    }


# Incident analysis endpoint
@app.post("/api/incidents/analyze")
async def analyze_coldchain_incident(payload: IncidentRequest):

    incident = analyze_incident(
        product_type=payload.product_type,
        quantity_kg=payload.quantity_kg,
        current_temp=payload.current_temp,
        required_temp=payload.required_temp
    )

    if not incident["rescue_required"]:
        return {
            "incident": incident,
            "rescue": None
        }

    providers = find_compatible_providers(
        product_type=payload.product_type,
        quantity_kg=payload.quantity_kg,
        required_temp=payload.required_temp
    )

    return {
        "incident": incident,
        "rescue": {
            "status": (
                "PROVIDERS_FOUND"
                if providers
                else "NO_COMPATIBLE_PROVIDER"
            ),
            "recommendation": providers[0] if providers else None,
            "alternatives": providers[1:] if providers else []
        }
    }
class OrchestratorRequest(BaseModel):
    product_type: str
    quantity_kg: float = Field(gt=0)
    current_temp: float
    required_temp: float

@app.post("/api/orchestrator/plan")
async def create_rescue_plan(payload: OrchestratorRequest):

    return orchestrate_rescue(
        product_type=payload.product_type,
        quantity_kg=payload.quantity_kg,
        current_temp=payload.current_temp,
        required_temp=payload.required_temp
    )


@app.post("/api/ai/analyze-incident")
async def analyze_incident_with_ai(
    payload: NaturalLanguageIncidentRequest
):
    try:
        return handle_natural_language_incident(
            payload.incident_description
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        print(f"AI incident analysis failed: {error}")
        raise HTTPException(
            status_code=500,
            detail="AI incident analysis failed. Check backend logs."
        )