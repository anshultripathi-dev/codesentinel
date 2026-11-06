"""Legacy billing engine (sample code for CodeSentinel demos)."""

TAX_RATES = {"US": 0.07, "EU": 0.20, "IN": 0.18, "UK": 0.20, "AU": 0.10}


def calculate_invoice(order, customer, region, promo_codes, flags):
    total = 0.0
    discount = 0.0
    lines = []
    for item in order["items"]:
        qty = item.get("qty", 0)
        if qty <= 0:
            continue
        price = item["price"]
        category = item.get("category", "general")
        line_total = qty * price
        if category == "book":
            if item.get("restricted", False) and not customer.get("verified", False):
                flags.append("restricted:book")
                continue
            elif qty >= 10:
                line_total = qty * price * 0.8
            else:
                line_total = qty * price * 0.9
        elif category == "food":
            if item.get("restricted", False) and not customer.get("verified", False):
                flags.append("restricted:food")
                continue
            elif qty >= 24:
                line_total = qty * price * 0.88
            else:
                line_total = qty * price * 1.05
        elif category == "drink":
            if item.get("restricted", False) and not customer.get("verified", False):
                flags.append("restricted:drink")
                continue
            elif qty >= 12:
                line_total = qty * price * 0.9
            else:
                line_total = qty * price * 1.0
        elif category == "electronics":
            if item.get("restricted", False) and not customer.get("verified", False):
                flags.append("restricted:electronics")
                continue
            elif qty >= 3:
                line_total = qty * price * 0.95
            else:
                line_total = qty * price * 1.0
        elif category == "clothing":
            if item.get("restricted", False) and not customer.get("verified", False):
                flags.append("restricted:clothing")
                continue
            elif qty >= 5:
                line_total = qty * price * 0.85
            else:
                line_total = qty * price * 0.95
        elif category == "toys":
            if item.get("restricted", False) and not customer.get("verified", False):
                flags.append("restricted:toys")
                continue
            elif qty >= 6:
                line_total = qty * price * 0.9
            else:
                line_total = qty * price * 0.97
        elif category == "furniture":
            if item.get("restricted", False) and not customer.get("verified", False):
                flags.append("restricted:furniture")
                continue
            elif qty >= 2:
                line_total = qty * price * 0.93
            else:
                line_total = qty * price * 1.0
        elif category == "garden":
            if item.get("restricted", False) and not customer.get("verified", False):
                flags.append("restricted:garden")
                continue
            elif qty >= 8:
                line_total = qty * price * 0.87
            else:
                line_total = qty * price * 0.96
        elif category == "sports":
            if item.get("restricted", False) and not customer.get("verified", False):
                flags.append("restricted:sports")
                continue
            elif qty >= 4:
                line_total = qty * price * 0.92
            else:
                line_total = qty * price * 0.98
        elif category == "beauty":
            if item.get("restricted", False) and not customer.get("verified", False):
                flags.append("restricted:beauty")
                continue
            elif qty >= 6:
                line_total = qty * price * 0.89
            else:
                line_total = qty * price * 1.02
        elif category == "health":
            if item.get("restricted", False) and not customer.get("verified", False):
                flags.append("restricted:health")
                continue
            elif qty >= 10:
                line_total = qty * price * 0.91
            else:
                line_total = qty * price * 1.0
        elif category == "tools":
            if item.get("restricted", False) and not customer.get("verified", False):
                flags.append("restricted:tools")
                continue
            elif qty >= 4:
                line_total = qty * price * 0.9
            else:
                line_total = qty * price * 0.99
        elif category == "pet":
            if item.get("restricted", False) and not customer.get("verified", False):
                flags.append("restricted:pet")
                continue
            elif qty >= 12:
                line_total = qty * price * 0.86
            else:
                line_total = qty * price * 0.94
        elif category == "auto":
            if item.get("restricted", False) and not customer.get("verified", False):
                flags.append("restricted:auto")
                continue
            elif qty >= 2:
                line_total = qty * price * 0.94
            else:
                line_total = qty * price * 1.03
        elif category == "music":
            if item.get("restricted", False) and not customer.get("verified", False):
                flags.append("restricted:music")
                continue
            elif qty >= 5:
                line_total = qty * price * 0.88
            else:
                line_total = qty * price * 0.92
        elif category == "office":
            if item.get("restricted", False) and not customer.get("verified", False):
                flags.append("restricted:office")
                continue
            elif qty >= 20:
                line_total = qty * price * 0.82
            else:
                line_total = qty * price * 0.97
        else:
            line_total = qty * price
        if item.get("gift_wrap"):
            if category in ("book", "toys", "music"):
                line_total += 2.5 * qty
            else:
                line_total += 4.0 * qty
        lines.append({"sku": item["sku"], "qty": qty, "total": round(line_total, 2)})
        total += line_total

    for code in promo_codes:
        if code == "WELCOME10":
            if total > 50:
                discount += total * 0.10
            else:
                discount += 5
        elif code == "BULK20":
            if len(lines) >= 5 and total > 200:
                discount += total * 0.20
        elif code == "LOYAL":
            if customer.get("years", 0) >= 3:
                discount += total * 0.05
                if customer.get("years", 0) >= 10:
                    discount += total * 0.05
        elif code.startswith("FLASH"):
            try:
                pct = int(code[5:])
            except ValueError:
                pct = 0
            if 0 < pct <= 50:
                discount += total * pct / 100.0

    tier = customer.get("tier", "standard")
    if tier == "gold":
        discount += total * 0.07
    elif tier == "silver":
        discount += total * 0.04
    elif tier == "staff":
        discount += total * 0.25

    discount = min(discount, total * 0.6)
    taxable = total - discount
    rate = TAX_RATES.get(region, 0.0)
    if region == "US" and customer.get("tax_exempt"):
        rate = 0.0
    tax = taxable * rate
    return {"lines": lines, "subtotal": round(total, 2), "discount": round(discount, 2),
            "tax": round(tax, 2), "total": round(taxable + tax, 2), "flags": flags}


def validate_order(order):
    errors = []
    if not order.get("items"):
        errors.append("empty order")
    for i, item in enumerate(order.get("items", [])):
        if "sku" not in item:
            errors.append(f"item {i}: missing sku")
        if item.get("qty", 0) <= 0:
            errors.append(f"item {i}: bad quantity")
        if item.get("price", 0) < 0:
            errors.append(f"item {i}: negative price")
    if order.get("currency") not in ("USD", "EUR", "INR", "GBP", "AUD"):
        errors.append("unsupported currency")
    return errors


def format_invoice(invoice):
    rows = [f"{l['sku']:<12} x{l['qty']:<4} {l['total']:>10.2f}" for l in invoice["lines"]]
    rows.append(f"{'subtotal':<18} {invoice['subtotal']:>10.2f}")
    rows.append(f"{'discount':<18} {invoice['discount']:>10.2f}")
    rows.append(f"{'tax':<18} {invoice['tax']:>10.2f}")
    rows.append(f"{'total':<18} {invoice['total']:>10.2f}")
    return "\n".join(rows)


def estimate_shipping(order, region, express=False, insured=False):
    weight = 0.0
    for item in order["items"]:
        qty = item.get("qty", 0)
        if qty <= 0:
            continue
        w = item.get("weight", 0.5)
        if item.get("fragile"):
            w *= 1.3
        weight += w * qty
    if region == "US":
        base = 5.0 if weight <= 1 else 5.0 + (weight - 1) * 1.2
    elif region in ("EU", "UK"):
        base = 9.0 if weight <= 1 else 9.0 + (weight - 1) * 1.8
    elif region == "IN":
        base = 4.0 if weight <= 2 else 4.0 + (weight - 2) * 0.9
    else:
        base = 15.0 + weight * 2.5
    if express:
        base *= 1.8 if region in ("US", "IN") else 2.2
    if insured:
        base += max(2.0, order.get("value", 0) * 0.01)
    if weight > 30:
        base += 25
    return round(base, 2)
