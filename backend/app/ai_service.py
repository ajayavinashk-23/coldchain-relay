
import json
import os

from openai import OpenAI


def get_openai_client():
    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is missing.")

    return OpenAI(api_key=api_key)


def get_model():
    return os.getenv("OPENAI_MODEL")


def generate_rescue_explanation(incident, decision, provider=None):
    client = get_openai_client()

    context = {
        "incident": incident,
        "backend_decision": decision,
        "selected_provider": provider
    }

    response = client.responses.create(
        model=get_model(),
        instructions=(
            "You are ColdChain Relay's AI assistant. "
            "Explain the supplied backend decision clearly. "
            "Use only supplied facts. Never invent availability, "
            "prices, capacity, transport times, or food safety conclusions. "
            "Never claim a booking or payment is complete."
        ),
        input=json.dumps(context, ensure_ascii=False),
        max_output_tokens=200
    )

    return response.output_text.strip()


def handle_natural_language_incident(incident_description):
    client = get_openai_client()

    tools = [
        {
            "type": "function",
            "name": "run_rescue_analysis",
            "description": (
                "Run the backend rescue engine for a cold-chain incident. "
                "Call this only when product type, quantity, current "
                "temperature and required temperature are known."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "product_type": {
                        "type": "string",
                        "enum": ["seafood", "dairy", "vegetables"]
                    },
                    "quantity_kg": {
                        "type": "number"
                    },
                    "current_temp": {
                        "type": "number"
                    },
                    "required_temp": {
                        "type": "number"
                    }
                },
                "required": [
                    "product_type",
                    "quantity_kg",
                    "current_temp",
                    "required_temp"
                ],
                "additionalProperties": False
            },
            "strict": True
        }
    ]

    instructions = """
    You are ColdChain Relay, an AI cold-chain emergency assistant.

    Understand the user's emergency report.

    If product type, quantity, current temperature, or required
    temperature is missing or ambiguous, ask the user for that
    information. Never invent missing values.

    When all four values are available, call run_rescue_analysis.

    Do not select providers yourself. The Python rescue engine
    determines provider compatibility and recommendations.

    Never authorize payments, make food safety determinations,
    or claim that a booking has been completed.

    After receiving the tool result, explain the outcome clearly.
    """

    conversation = [
        {
            "role": "user",
            "content": incident_description
        }
    ]

    response = client.responses.create(
        model=get_model(),
        instructions=instructions,
        input=conversation,
        tools=tools,
        tool_choice="auto",
        max_output_tokens=300
    )

    structured_result = None

    for item in response.output:
        if item.type != "function_call":
            continue

        if item.name != "run_rescue_analysis":
            continue

        arguments = json.loads(item.arguments)

        # Validate AI-extracted values before calling backend logic.
        if arguments["product_type"] not in {
            "seafood", "dairy", "vegetables"
        }:
            raise ValueError("Unsupported product type.")

        if arguments["quantity_kg"] <= 0:
            raise ValueError("Quantity must be greater than zero.")

        from app.orchestrator import orchestrate_rescue

        structured_result = orchestrate_rescue(
            product_type=arguments["product_type"],
            quantity_kg=arguments["quantity_kg"],
            current_temp=arguments["current_temp"],
            required_temp=arguments["required_temp"]
        )

        conversation.append(item)

        conversation.append({
            "type": "function_call_output",
            "call_id": item.call_id,
            "output": json.dumps(
                structured_result,
                ensure_ascii=False
            )
        })

    # If the model asked a clarification question, return it directly.
    if structured_result is None:
        return {
            "status": "NEEDS_CLARIFICATION",
            "ai_response": response.output_text,
            "rescue_result": None
        }

    final_response = client.responses.create(
        model=get_model(),
        instructions=instructions,
        input=conversation,
        tools=tools,
        tool_choice="none",
        max_output_tokens=300
    )

    return {
        "status": "ANALYSIS_COMPLETED",
        "ai_response": final_response.output_text,
        "rescue_result": structured_result
    }
