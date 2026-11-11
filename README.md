# ColdChain Relay

ColdChain Relay is a hackathon MVP for coordinating emergency responses to cold-chain disruptions. It combines natural-language incident intake, deterministic provider compatibility checks, a rescue recommendation, human review, and a PayPal Sandbox checkout demonstration.

> **Prototype boundary:** provider inventory and availability are simulated in `backend/app/rescue_engine.py`. Temperature severity thresholds are demonstration rules, not validated food-safety limits. PayPal charges a fixed **$24.00 USD Sandbox demo amount**; it does not pay the provider, act as escrow, or settle the listed INR service cost. Do not use this prototype to make food-safety decisions or dispatch real shipments.

## Features

- Natural-language incident intake using the OpenAI Responses API.
- Clarification when incident details are missing.
- Deterministic matching by product compatibility, capacity, configured temperature range, and provider availability.
- Ranking by listed cost, then distance.
- Manual incident entry as a fallback.
- Human approval step in the frontend.
- PayPal Orders API create/capture flow in Sandbox.
- FastAPI Swagger docs at `/docs`.

## Architecture

```text
React + Vite
    |
    | HTTP / JSON
    v
FastAPI
    |-- AI service (OpenAI Responses API)
    |-- Incident rules
    |-- Rescue engine (simulated provider data)
    |-- PayPal OAuth + Orders API (Sandbox)
    |
    v
In-memory demo booking/order state
```

## Requirements

- Python 3.12 recommended
- Node.js 20.19+ or 22.12+ recommended for current Vite
- npm
- OpenAI API key (optional for manual incident analysis; required for natural-language AI)
- PayPal Sandbox REST app credentials (required for checkout)

## Setup on Windows PowerShell

From the project root:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
Copy-Item backend/.env.example backend/.env
```

Edit `backend/.env` and provide your OpenAI and PayPal Sandbox credentials. Keep this file private.

Create the frontend environment file:

```powershell
Copy-Item frontend/.env.example frontend/.env
```

Edit `frontend/.env` and set `VITE_PAYPAL_CLIENT_ID` to the same PayPal Sandbox Client ID used by the backend. The Client ID is intended for browser use; never put the PayPal Client Secret or OpenAI API key in the frontend.

Install frontend dependencies:

```powershell
cd frontend
npm install
cd ..
```

## Run

Open two terminals at the project root.

Terminal 1 — backend:

```powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --app-dir backend
```

Backend: http://127.0.0.1:8000  
API docs: http://127.0.0.1:8000/docs

Terminal 2 — frontend:

```powershell
cd frontend
npm run dev
```

Frontend: http://localhost:5173

## Demo scenario

Paste this into **Describe your emergency**:

> Our refrigerated seafood truck has experienced a cooling system failure. We are transporting 500 kg of seafood, and the current temperature has risen to 8.5°C. The required storage temperature is 2°C. We urgently need a compatible emergency cold-storage provider.

With the current sample provider data, Blue Frost Logistics should be the first eligible recommendation. All provider details are simulated.

Other useful scenarios:

- Missing information: `Our dairy truck's refrigeration system has failed. Can you help us find emergency cold storage?`
- No capacity match: `A refrigerated truck carrying 2,000 kg of seafood has suffered a cooling failure. The current temperature is 9°C, and the required temperature is 2°C.`
- No deviation: `Our seafood truck is carrying 500 kg of seafood at 2°C. The required temperature is 2°C. Check whether rescue is required.`

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | API identity and environment |
| GET | `/health` | Health check |
| POST | `/api/ai/analyze-incident` | Natural-language AI intake |
| POST | `/api/orchestrator/plan` | Deterministic rescue orchestration |
| POST | `/api/rescue/recommend` | Provider compatibility search |
| POST | `/api/incidents/analyze` | Incident severity analysis |
| POST | `/api/paypal/create-order` | Create PayPal Sandbox order |
| POST | `/api/paypal/capture/{order_id}` | Capture approved Sandbox order |

## Current limitations and production work

This is a demonstrable MVP, not a production logistics or payment platform.

1. Provider records are hard-coded demo data; no live provider capacity, route, or booking integration exists.
2. Booking/order state is held in memory and is lost when the backend restarts.
3. Frontend approval is a demo interaction, not a production authorization workflow.
4. The PayPal charge is a fixed Sandbox demonstration amount and is separate from provider pricing.
5. No provider payout, escrow, marketplace settlement, or refund workflow is implemented.
6. No sensor/MQTT ingestion, shipment GPS, route ETA, or delivery evidence integration is implemented.
7. The incident severity rules are illustrative. Product-specific handling limits must come from validated regulations and qualified operators.
8. Add authentication, role-based access, persistent database transactions, audit logs, webhook verification, rate limiting, monitoring, and provider verification before production use.

## Security

- Never commit `.env` files, API keys, PayPal Client Secrets, access tokens, or customer data.
- Rotate any credentials that were accidentally included in a shared archive or repository.
- Keep secrets on the backend. Only the PayPal Client ID belongs in the frontend environment.
- Use Sandbox credentials for demonstrations.

## Project structure

```text
coldchain-relay/
├── backend/
│   ├── app/
│   │   ├── ai_service.py
│   │   ├── incident_service.py
│   │   ├── main.py
│   │   ├── orchestrator.py
│   │   └── rescue_engine.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env.example
│   └── package.json
├── .gitignore
└── README.md
```
