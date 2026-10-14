"""Sample module used for demos."""


def price(order, rules):
    total = 0
    for item in order["items"]:
        if item["qty"] > 0:
            if item["type"] == "book":
                total += item["qty"] * item["price"] * 0.9
            elif item["type"] == "food":
                if item.get("perishable"):
                    total += item["qty"] * item["price"] * 1.05
                else:
                    total += item["qty"] * item["price"]
            else:
                for r in rules:
                    if r["applies"](item) and r["active"]:
                        total += r["fn"](item)
                        break
                else:
                    total += item["qty"] * item["price"]
    return total


def clean(x):
    return x.strip()
