
PROVIDERS = [
    {
        "id": "provider-A",
        "name": "Arctic Storage",
        "distance_km": 4,
        "capacity_kg": 300,
        "compatible_products": ["seafood"],
        "min_temp": 0,
        "max_temp": 4,
        "cost": 1800,
        "available": True
    },
    {
        "id": "provider-B",
        "name": "Blue Frost Logistics",
        "distance_km": 9,
        "capacity_kg": 700,
        "compatible_products": ["seafood"],
        "min_temp": -2,
        "max_temp": 3,
        "cost": 2400,
        "available": True
    },
    {
        "id": "provider-C",
        "name": "Polar Storage",
        "distance_km": 15,
        "capacity_kg": 1000,
        "compatible_products": ["seafood"],
        "min_temp": -5,
        "max_temp": 2,
        "cost": 3100,
        "available": True
    }
]


def find_compatible_providers(
    product_type: str,
    quantity_kg: float,
    required_temp: float
):
    compatible = []

    for provider in PROVIDERS:

        # Check provider availability
        if not provider["available"]:
            continue

        # Check storage capacity
        if provider["capacity_kg"] < quantity_kg:
            continue

        # Check product compatibility
        if product_type not in provider["compatible_products"]:
            continue

        # Check temperature compatibility
        if not (
            provider["min_temp"]
            <= required_temp
            <= provider["max_temp"]
        ):
            continue

        compatible.append(provider)

    # Rank eligible providers by cost, then distance
    compatible.sort(
        key=lambda p: (p["cost"], p["distance_km"])
    )

    return compatible
