
import { useEffect, useState } from "react";
import "./App.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function App() {
  // -------------------------------------
  // INCIDENT DETAILS
  // -------------------------------------

  const [incident, setIncident] = useState({
    product_type: "seafood",
    quantity_kg: 500,
    current_temp: 8.5,
    required_temp: 2
  });

  // -------------------------------------
  // NATURAL LANGUAGE AI INPUT
  // -------------------------------------

  const [incidentDescription, setIncidentDescription] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // -------------------------------------
  // ORCHESTRATOR RESULTS
  // -------------------------------------

  const [incidentResult, setIncidentResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [incidentError, setIncidentError] = useState("");

  // -------------------------------------
  // PROVIDER SELECTION
  // -------------------------------------

  const [selectedProvider, setSelectedProvider] = useState(null);

  // -------------------------------------
  // HUMAN APPROVAL
  // -------------------------------------

  const [humanApproved, setHumanApproved] = useState(false);

  // -------------------------------------
  // PAYPAL PAYMENT
  // -------------------------------------

  const [payment, setPayment] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [status, setStatus] = useState("Initializing PayPal...");

  const recommendation = incidentResult?.recommendation;
  const alternatives = incidentResult?.alternatives || [];

  // -------------------------------------
  // PAYPAL SDK INITIALIZATION
  // -------------------------------------

  useEffect(() => {
    if (!import.meta.env.VITE_PAYPAL_CLIENT_ID) {
      setStatus("PayPal Client ID is missing.");
      return;
    }

    if (!window.paypal) {
      setStatus("PayPal SDK failed to load.");
      return;
    }

    setStatus("PayPal sandbox is ready.");
  }, []);

  // -------------------------------------
  // RESET BOOKING WORKFLOW
  // -------------------------------------

  function resetBooking() {
    setIncidentResult(null);
    setSelectedProvider(null);
    setHumanApproved(false);
    setPayment(null);
    setIncidentError("");
    setStatus("Analyze an incident to begin.");
  }

  // -------------------------------------
  // UPDATE INCIDENT FORM
  // -------------------------------------

  function updateIncident(field, value) {
    setIncident((previous) => ({
      ...previous,
      [field]: value
    }));

    resetBooking();

    setAiResult(null);
    setAiError("");
  }

  // -------------------------------------
  // NATURAL LANGUAGE AI ANALYSIS
  // -------------------------------------

  async function submitNaturalLanguageIncident() {
    if (incidentDescription.trim().length < 10) {
      setAiError("Please describe the emergency in more detail.");
      return;
    }

    try {
      setAiLoading(true);
      setAiError("");
      setAiResult(null);

      resetBooking();

      setStatus("OpenAI is analyzing the emergency...");

      const response = await fetch(
        `${API_URL}/api/ai/analyze-incident`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            incident_description: incidentDescription
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail || "AI incident analysis failed."
        );
      }

      setAiResult(result);

      // Load the AI-generated rescue result
      // into the existing booking workflow.

      if (result.rescue_result) {
        const rescue = result.rescue_result;

        setIncidentResult(rescue);

        if (rescue.incident) {
          setIncident({
            product_type: rescue.incident.product_type,
            quantity_kg: rescue.incident.quantity_kg,
            current_temp: rescue.incident.current_temp,
            required_temp: rescue.incident.required_temp
          });
        }

        if (rescue.recommendation) {
          setSelectedProvider(rescue.recommendation);

          setStatus(
            "AI rescue analysis completed. Review the recommended provider."
          );
        } else {
          setStatus(
            rescue.decision?.message || "AI analysis completed."
          );
        }
      } else {
        setStatus("AI needs additional incident information.");
      }

    } catch (error) {
      setAiError(error.message);
      setStatus("AI analysis failed.");
    } finally {
      setAiLoading(false);
    }
  }

  // -------------------------------------
  // MANUAL INCIDENT ANALYSIS
  // -------------------------------------

  async function analyzeIncident() {
    try {
      setAnalyzing(true);
      setIncidentError("");

      resetBooking();
      setAiResult(null);
      setAiError("");

      setStatus("Orchestrating rescue analysis...");

      const response = await fetch(
        `${API_URL}/api/orchestrator/plan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            product_type: incident.product_type,
            quantity_kg: Number(incident.quantity_kg),
            current_temp: Number(incident.current_temp),
            required_temp: Number(incident.required_temp)
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail || "Orchestrator analysis failed."
        );
      }

      setIncidentResult(result);

      if (result.recommendation) {
        setSelectedProvider(result.recommendation);
        setStatus("Rescue plan generated successfully.");
      } else {
        setStatus(
          result.decision?.message || "No rescue plan available."
        );
      }

    } catch (error) {
      setIncidentError(error.message);
      setStatus("Incident analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  // -------------------------------------
  // SELECT ALTERNATIVE PROVIDER
  // -------------------------------------

  function selectProvider(provider) {
    setSelectedProvider(provider);
    setHumanApproved(false);
    setPayment(null);

    setStatus("Review the selected provider before approval.");
  }

  // -------------------------------------
  // HUMAN APPROVAL
  // -------------------------------------

  function approveRescue() {
    if (!selectedProvider) {
      setStatus("Select a rescue provider first.");
      return;
    }

    setHumanApproved(true);

    setStatus(
      "Rescue plan approved locally. Payment can now be initiated."
    );
  }

  // -------------------------------------
  // PAYPAL ORDER CREATION AND CAPTURE
  // -------------------------------------

  async function startCheckout() {
    if (!selectedProvider || !humanApproved) {
      setStatus("Human approval is required before payment.");
      return;
    }

    if (!window.paypal) {
      setStatus("PayPal SDK is unavailable.");
      return;
    }

    try {
      setCheckoutLoading(true);
      setPayment(null);

      setStatus("Creating rescue booking...");

      const response = await fetch(
        `${API_URL}/api/paypal/create-order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            provider_id: selectedProvider.id,
            product_type: incident.product_type,
            quantity_kg: Number(incident.quantity_kg),
            required_temp: Number(incident.required_temp)
          })
        }
      );

      const order = await response.json();

      if (!response.ok) {
        throw new Error(
          order.detail || "Rescue booking creation failed."
        );
      }

      const sdk = await window.paypal.createInstance({
        clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID,
        components: ["paypal-payments"],
        pageType: "checkout"
      });

      const methods = await sdk.findEligibleMethods({
        currencyCode: order.paypal_demo_currency
      });

      if (!methods.isEligible("paypal")) {
        throw new Error("PayPal is not eligible for this session.");
      }

      const paymentSession =
        sdk.createPayPalOneTimePaymentSession({

          async onApprove(data) {
            setStatus("Payment approved. Capturing payment...");

            try {
              const captureResponse = await fetch(
                `${API_URL}/api/paypal/capture/${data.orderId}`,
                {
                  method: "POST"
                }
              );

              const captureResult =
                await captureResponse.json();

              if (!captureResponse.ok) {
                throw new Error(
                  captureResult.detail || "Payment capture failed."
                );
              }

              setPayment(captureResult);
              setStatus("Payment successfully captured!");

            } catch (error) {
              setStatus(error.message);
            } finally {
              setCheckoutLoading(false);
            }
          },

          onCancel() {
            setStatus("Payment was cancelled.");
            setCheckoutLoading(false);
          },

          onError(error) {
            setStatus(
              error.message || "PayPal checkout error."
            );
            setCheckoutLoading(false);
          }
        });

      setStatus("Opening PayPal checkout...");

      await paymentSession.start(
        { presentationMode: "auto" },
        Promise.resolve({
          orderId: order.id
        })
      );

    } catch (error) {
      console.error("PayPal checkout error:", error);

      setStatus(error.message || "Checkout failed.");
      setCheckoutLoading(false);
    }
  }

  // =====================================
  // USER INTERFACE
  // =====================================

  return (
    <div className="app">

      {/* NAVIGATION */}

      <nav className="navbar">

        <div className="logo">
          <span className="logo-icon">C</span>
          COLDCHAIN RELAY
        </div>

        <span className="environment">
          SANDBOX ENVIRONMENT
        </span>

      </nav>

      <main className="container">

        {/* HERO SECTION */}

        <div className="heading">

          <span className="eyebrow">
            AUTONOMOUS EMERGENCY RESPONSE NETWORK
          </span>

          <h1>
            Save your inventory.
            <br />
            <span>Before it's too late.</span>
          </h1>

          <p>
            Intelligent emergency cold-storage coordination
            powered by AI and automated rescue orchestration.
          </p>

        </div>

        {/* =================================
            NATURAL LANGUAGE AI INCIDENT
        ================================= */}

        <section className="booking-card">

          <div className="card-header">

            <div>
              <span className="eyebrow">
                OPENAI INTELLIGENCE
              </span>

              <h2>Describe your emergency</h2>
            </div>

            <span className="live-tag">
              AI POWERED
            </span>

          </div>

          <p>
            Describe your cold-chain problem in ordinary language.
            The AI will extract incident details and request a
            rescue analysis when enough information is available.
          </p>

          <textarea
            placeholder="Example: Our seafood truck has a refrigeration failure. We have 500 kg of seafood at 8.5°C and need storage at 2°C. Find an emergency provider."
            value={incidentDescription}
            onChange={(e) => {
              setIncidentDescription(e.target.value);
              setAiResult(null);
              setAiError("");
            }}
            rows={5}
          />

          <button
            onClick={submitNaturalLanguageIncident}
            disabled={
              aiLoading ||
              incidentDescription.trim().length < 10
            }
          >
            {aiLoading
              ? "AI analyzing emergency..."
              : "Analyze Emergency with AI"}
          </button>

          {aiError && (
            <p className="error">{aiError}</p>
          )}

          {/* AI RESPONSE */}

          {aiResult && (
            <div className="ai-explanation">

              <span className="eyebrow">
                AI RESPONSE
              </span>

              <h3>Emergency Analysis</h3>

              <p>{aiResult.ai_response}</p>

              {aiResult.status === "NEEDS_CLARIFICATION" && (
                <p>
                  Please provide the missing information so
                  the rescue engine can evaluate the incident.
                </p>
              )}

              {aiResult.rescue_result?.recommendation && (
                <>
                  <h3>Recommended Provider</h3>

                  <p>
                    <strong>
                      {aiResult.rescue_result.recommendation.name}
                    </strong>
                  </p>

                  <p>
                    Service cost: ₹
                    {Number(
                      aiResult.rescue_result.recommendation.cost
                    ).toLocaleString("en-IN")}
                  </p>

                  <p>
                    Human approval required: Yes
                  </p>
                </>
              )}

              {aiResult.rescue_result?.status ===
                "NO_COMPATIBLE_PROVIDER" && (
                <p className="error">
                  No compatible provider was found.
                </p>
              )}

            </div>
          )}

        </section>

        {/* =================================
            MANUAL INCIDENT MANAGEMENT
        ================================= */}

        <section className="booking-card">

          <div className="card-header">

            <div>
              <span className="eyebrow">
                INCIDENT MANAGEMENT
              </span>

              <h2>Report cold-chain emergency</h2>
            </div>

            <span className="live-tag">
              SIMULATION
            </span>

          </div>

          <div className="booking-details">

            <label>
              Product type

              <select
                value={incident.product_type}
                onChange={(e) =>
                  updateIncident("product_type", e.target.value)
                }
              >
                <option value="seafood">Seafood</option>
                <option value="dairy">Dairy</option>
                <option value="vegetables">Vegetables</option>
              </select>

            </label>

            <label>
              Inventory quantity (kg)

              <input
                type="number"
                min="1"
                value={incident.quantity_kg}
                onChange={(e) =>
                  updateIncident("quantity_kg", e.target.value)
                }
              />

            </label>

            <label>
              Current temperature (°C)

              <input
                type="number"
                step="0.1"
                value={incident.current_temp}
                onChange={(e) =>
                  updateIncident("current_temp", e.target.value)
                }
              />

            </label>

            <label>
              Required temperature (°C)

              <input
                type="number"
                step="0.1"
                value={incident.required_temp}
                onChange={(e) =>
                  updateIncident("required_temp", e.target.value)
                }
              />

            </label>

          </div>

          <button
            onClick={analyzeIncident}
            disabled={
              analyzing ||
              Number(incident.quantity_kg) <= 0 ||
              incident.quantity_kg === ""
            }
          >
            {analyzing
              ? "Orchestrating rescue..."
              : "Analyze Emergency"}
          </button>

          {incidentError && (
            <p className="error">{incidentError}</p>
          )}

        </section>

        {/* =================================
            ORCHESTRATOR RESULTS
        ================================= */}

        {incidentResult && (
          <section className="booking-card">

            <div className="card-header">

              <div>
                <span className="eyebrow">
                  RESCUE ORCHESTRATOR
                </span>

                <h2>Emergency analysis</h2>
              </div>

              <span className="live-tag">
                {incidentResult.status}
              </span>

            </div>

            {/* INCIDENT ASSESSMENT */}

            <div className="incident-result">

              <h3>Incident Assessment</h3>

              <p>
                Severity:{" "}
                <strong>
                  {incidentResult.incident.severity}
                </strong>
              </p>

              <p>
                Temperature deviation:{" "}
                {incidentResult.incident.temperature_deviation}°C
              </p>

              <p>
                Rescue required:{" "}
                {incidentResult.incident.rescue_required
                  ? "Yes"
                  : "No"}
              </p>

            </div>

            {/* BACKEND DECISION */}

            <div className="incident-result">

              <h3>Orchestrator Decision</h3>

              <p>
                {incidentResult.decision?.message}
              </p>

              <p>
                {incidentResult.decision?.reason}
              </p>

              {incidentResult.decision?.selection_method && (
                <p>
                  Selection method:{" "}
                  {incidentResult.decision.selection_method}
                </p>
              )}

              <p>
                Human approval required:{" "}
                {incidentResult.human_approval_required
                  ? "Yes"
                  : "No"}
              </p>

            </div>

            {/* AI EXPLANATION */}

            {incidentResult.ai_explanation && (
              <div className="ai-explanation">

                <span className="eyebrow">
                  OPENAI INTELLIGENCE
                </span>

                <h3>AI Rescue Analysis</h3>

                <p>{incidentResult.ai_explanation}</p>

              </div>
            )}

            {/* RECOMMENDED PROVIDER */}

            {recommendation && (
              <div className="incident-result">

                <h3>Recommended Rescue Provider</h3>

                <p>
                  Provider:{" "}
                  <strong>{recommendation.name}</strong>
                </p>

                <p>
                  Capacity: {recommendation.capacity_kg} kg
                </p>

                <p>
                  Distance: {recommendation.distance_km} km
                </p>

                <p>
                  Service cost:{" "}
                  <strong>
                    ₹
                    {Number(recommendation.cost).toLocaleString("en-IN")}
                  </strong>
                </p>

                <p>
                  Provider ID: {recommendation.id}
                </p>

                {selectedProvider?.id === recommendation.id && (
                  <p>
                    <strong>Currently selected</strong>
                  </p>
                )}

              </div>
            )}

            {/* ALTERNATIVE PROVIDERS */}

            {alternatives.length > 0 && (
              <div className="incident-result">

                <h3>Alternative Providers</h3>

                {alternatives.map((provider) => (
                  <div
                    key={provider.id}
                    className="provider-option"
                  >

                    <p>
                      <strong>{provider.name}</strong>
                    </p>

                    <p>
                      Capacity: {provider.capacity_kg} kg
                    </p>

                    <p>
                      Distance: {provider.distance_km} km
                    </p>

                    <p>
                      Cost: ₹
                      {Number(provider.cost).toLocaleString("en-IN")}
                    </p>

                    <button
                      onClick={() => selectProvider(provider)}
                      disabled={
                        selectedProvider?.id === provider.id
                      }
                    >
                      {selectedProvider?.id === provider.id
                        ? "Selected"
                        : "Select this provider"}
                    </button>

                  </div>
                ))}

              </div>
            )}

            {/* HUMAN APPROVAL */}

            {selectedProvider && (
              <div className="incident-result">

                <h3>Rescue Authorization</h3>

                <p>
                  Selected provider:{" "}
                  <strong>{selectedProvider.name}</strong>
                </p>

                <p>
                  Provider service cost: ₹
                  {Number(selectedProvider.cost).toLocaleString("en-IN")}
                </p>

                <p>
                  Review the recommendation before authorizing
                  the PayPal demo transaction.
                </p>

                {!humanApproved ? (
                  <button onClick={approveRescue}>
                    Approve Rescue Plan
                  </button>
                ) : (
                  <p>
                    <strong>
                      Rescue plan approved locally.
                    </strong>
                  </p>
                )}

              </div>
            )}

            {incidentResult.status === "NO_COMPATIBLE_PROVIDER" && (
              <p className="error">
                No compatible provider was found.
              </p>
            )}

            {incidentResult.status === "NO_RESCUE_REQUIRED" && (
              <p>
                No rescue is required according to the current
                incident rules.
              </p>
            )}

          </section>
        )}

        {/* =================================
            PAYPAL BOOKING AND PAYMENT
        ================================= */}

        <section className="booking-card">

          <div className="card-header">

            <div>
              <span className="eyebrow">
                RESCUE BOOKING
              </span>

              <h2>Emergency cold storage</h2>
            </div>

            <span className="live-tag">
              PAYPAL SANDBOX
            </span>

          </div>

          {selectedProvider ? (
            <>

              <div className="booking-details">

                <div>
                  <span>Inventory</span>

                  <strong>
                    {incident.quantity_kg} kg {incident.product_type}
                  </strong>
                </div>

                <div>
                  <span>Target temperature</span>

                  <strong>{incident.required_temp}°C</strong>
                </div>

                <div>
                  <span>Selected provider</span>

                  <strong>{selectedProvider.name}</strong>
                </div>

              </div>

              <div className="price-section">

                <span>Provider service cost (INR)</span>

                <strong>
                  ₹
                  {Number(selectedProvider.cost).toLocaleString("en-IN")}
                </strong>

              </div>

              <div className="payment-section">

                <p>
                  PayPal demo charge: <strong>$24.00 USD</strong>
                </p>

                <p>
                  This sandbox transaction is separate from
                  the provider's listed INR service cost.
                </p>

                <button
                  onClick={startCheckout}
                  disabled={
                    !humanApproved ||
                    checkoutLoading ||
                    !!payment
                  }
                >
                  {checkoutLoading
                    ? "Processing payment..."
                    : payment
                      ? "Payment completed"
                      : humanApproved
                        ? "Confirm Rescue & Pay with PayPal"
                        : "Approve rescue plan first"}
                </button>

                <div className="status">

                  <span className="status-dot"></span>

                  {status}

                </div>

              </div>

            </>
          ) : (
            <p>
              Analyze an emergency and select a compatible
              provider to create a rescue booking.
            </p>
          )}

          {/* PAYMENT CONFIRMATION */}

          {payment && (
            <div className="success">

              <h3>Payment confirmed successfully</h3>

              <p>
                Transaction status:{" "}
                <strong>{payment.status}</strong>
              </p>

              <p>
                PayPal order: {payment.order_id}
              </p>

              <p>
                Rescue ID: {payment.rescue_id}
              </p>

              <p>
                Provider: {payment.provider?.name}
              </p>

              <p>
                Provider service cost: ₹
                {Number(payment.provider_cost).toLocaleString("en-IN")}
              </p>

              <p>
                PayPal demo payment: $
                {payment.paypal_demo_amount}{" "}
                {payment.paypal_demo_currency}
              </p>

            </div>
          )}

        </section>

        {/* FOOTER */}

        <footer>
          COLDCHAIN RELAY · AI-POWERED EMERGENCY LOGISTICS
        </footer>

      </main>

    </div>
  );
}

export default App;
