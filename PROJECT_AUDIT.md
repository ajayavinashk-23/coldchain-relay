# Project audit and handoff

## What was present in the uploaded archive

- FastAPI backend with OpenAI incident intake and explanation.
- Deterministic rescue engine with three hard-coded seafood provider records.
- React/Vite frontend with manual and natural-language incident forms.
- PayPal Sandbox order creation and capture.
- Basic dark UI styling.

## What was improved in this handoff

- Added a backend dependency manifest (the uploaded `backend/requirements.txt` was empty).
- Added backend and frontend `.env.example` templates; real `.env` files are deliberately excluded.
- Replaced the empty README with Windows setup, run instructions, demo scenarios, endpoint documentation, architecture and limitations.
- Improved form, button, provider, result, error, and mobile styling.
- Added five deterministic tests for provider matching and incident rules.
- Removed the ad hoc OpenAI test script so it does not make unexpected billable API calls.
- Excluded `.git`, `.venv`, `node_modules`, caches and environment secrets from the handoff archive.

## Verification performed

- Python syntax compilation: passed.
- Backend unit tests: 5 passed.
- Frontend production build: not verified in this environment because the dependency installation did not complete and the Vite executable was unavailable. Run `npm ci` followed by `npm run build` locally.

## Known MVP limitations

These are functional boundaries, not hidden features:

1. Provider inventory, capacity, distance, costs and availability are hard-coded simulation data.
2. The backend stores rescue bookings, PayPal order mappings and capture results in process memory; restarting the backend clears them.
3. The human approval step is currently frontend/local state. It is not a secure server-side authorization record.
4. PayPal Sandbox charges a fixed $24.00 USD demo amount. It is not the listed provider INR service fee, escrow, a provider payout, or a marketplace settlement.
5. No PayPal webhook signature verification or asynchronous reconciliation is implemented.
6. No sensor/MQTT ingestion, live GPS, routing ETA, warehouse API, verified provider booking, or delivery evidence exists.
7. Temperature deviation and severity thresholds are demonstration rules. They are not product-specific food safety advice.

## Before any public demo or repository push

- Rotate OpenAI and PayPal credentials if the uploaded `.env` files or Git history were ever shared or pushed.
- Keep backend secrets only in `backend/.env` on your machine or deployment secret manager.
- Use only PayPal Sandbox credentials for the hackathon demonstration.
- Never describe simulated providers as live inventory or the demo payment as a provider payment.
