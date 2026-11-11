
def analyze_incident(
    product_type: str,
    quantity_kg: float,
    current_temp: float,
    required_temp: float
):
    if quantity_kg <= 0:
        raise ValueError("Quantity must be greater than zero.")

    temperature_deviation = current_temp - required_temp

    if temperature_deviation <= 0:
        severity = "NORMAL"
        rescue_required = False

    elif temperature_deviation <= 2:
        severity = "WARNING"
        rescue_required = True

    else:
        severity = "CRITICAL"
        rescue_required = True

    return {
        "product_type": product_type,
        "quantity_kg": quantity_kg,
        "current_temp": current_temp,
        "required_temp": required_temp,
        "temperature_deviation": temperature_deviation,
        "severity": severity,
        "rescue_required": rescue_required
    }
