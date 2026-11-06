"""Refactored pricing: the same behaviour as the legacy version, split into small functions."""

CATEGORY_RULES = {
    "book": (0.9, 10, 0.8),
    "food": (1.05, 24, 0.88),
    "drink": (1.0, 12, 0.9),
    "electronics": (1.0, 3, 0.95),
    "clothing": (0.95, 5, 0.85),
    "toys": (0.97, 6, 0.9),
    "furniture": (1.0, 2, 0.93),
    "garden": (0.96, 8, 0.87),
    "sports": (0.98, 4, 0.92),
    "beauty": (1.02, 6, 0.89),
    "health": (1.0, 10, 0.91),
    "tools": (0.99, 4, 0.9),
    "pet": (0.94, 12, 0.86),
    "auto": (1.03, 2, 0.94),
    "music": (0.92, 5, 0.88),
    "office": (0.97, 20, 0.82),
}
TAX_RATES = {"US": 0.07, "EU": 0.20, "IN": 0.18, "UK": 0.20, "AU": 0.10}


def line_total(item, customer):
    """Price one order line, or None when the line is restricted for this customer."""
    qty, price = item.get("qty", 0), item["price"]
    base, bulk_qty, bulk_rate = CATEGORY_RULES.get(item.get("category"), (1.0, 0, 1.0))
    if item.get("restricted", False) and not customer.get("verified", False):
        return None
    rate = bulk_rate if bulk_qty and qty >= bulk_qty else base
    return qty * price * rate


def gift_wrap_fee(item):
    per_unit = 2.5 if item.get("category") in ("book", "toys", "music") else 4.0
    return per_unit * item.get("qty", 0) if item.get("gift_wrap") else 0.0


def promo_discount(code, total, line_count, customer):
    if code == "WELCOME10":
        return total * 0.10 if total > 50 else 5
    if code == "BULK20":
        return total * 0.20 if line_count >= 5 and total > 200 else 0
    if code == "LOYAL":
        years = customer.get("years", 0)
        return total * (0.10 if years >= 10 else 0.05) if years >= 3 else 0
    if code.startswith("FLASH") and code[5:].isdigit():
        pct = int(code[5:])
        return total * pct / 100.0 if 0 < pct <= 50 else 0
    return 0


def tier_discount(tier, total):
    return total * {"gold": 0.07, "silver": 0.04, "staff": 0.25}.get(tier, 0.0)


def tax_rate(region, customer):
    if region == "US" and customer.get("tax_exempt"):
        return 0.0
    return TAX_RATES.get(region, 0.0)


def calculate_invoice(order, customer, region, promo_codes, flags):
    lines, total = [], 0.0
    for item in order["items"]:
        if item.get("qty", 0) <= 0:
            continue
        amount = line_total(item, customer)
        if amount is None:
            flags.append("restricted:" + str(item.get("category")))
            continue
        amount += gift_wrap_fee(item)
        lines.append({"sku": item["sku"], "qty": item["qty"], "total": round(amount, 2)})
        total += amount
    discount = sum(promo_discount(c, total, len(lines), customer) for c in promo_codes)
    discount = min(discount + tier_discount(customer.get("tier", "standard"), total), total * 0.6)
    taxable = total - discount
    tax = taxable * tax_rate(region, customer)
    return {"lines": lines, "subtotal": round(total, 2), "discount": round(discount, 2),
            "tax": round(tax, 2), "total": round(taxable + tax, 2), "flags": flags}
