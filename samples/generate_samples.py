"""Generate the demo sample projects (several languages, clean vs legacy) and zip them.

Run from the repository root:  python samples/generate_samples.py [output_dir]
Output: <output_dir>/NN_<project>/... sources and <output_dir>/zips/NN_<project>.zip
The default output directory is this folder. Only generated NN_* folders and zips/ are replaced.
"""
import re
import shutil
import sys
import zipfile
from pathlib import Path

OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent

# (category, base multiplier, bulk quantity, bulk multiplier)
CATS = [
    ("book", 0.90, 10, 0.80), ("food", 1.05, 24, 0.88), ("drink", 1.00, 12, 0.90), ("electronics", 1.00, 3, 0.95),
    ("clothing", 0.95, 5, 0.85), ("toys", 0.97, 6, 0.90), ("furniture", 1.00, 2, 0.93), ("garden", 0.96, 8, 0.87),
    ("sports", 0.98, 4, 0.92), ("beauty", 1.02, 6, 0.89), ("health", 1.00, 10, 0.91), ("tools", 0.99, 4, 0.90),
    ("pet", 0.94, 12, 0.86), ("auto", 1.03, 2, 0.94), ("music", 0.92, 5, 0.88), ("office", 0.97, 20, 0.82),
]


def pick(n):
    return CATS[:n]


def files(root: Path, mapping: dict):
    for rel, text in mapping.items():
        p = root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text.lstrip("\n"))


# ============================================================ PYTHON
def py_chain(n, ind):
    pad = " " * ind
    out = []
    for i, (cat, base, bq, bm) in enumerate(pick(n)):
        kw = "if" if i == 0 else "elif"
        out.append(f'{pad}{kw} category == "{cat}":')
        out.append(f'{pad}    if item.get("restricted", False) and not customer.get("verified", False):')
        out.append(f"{pad}        flags.append(\"restricted:{cat}\")")
        out.append(f"{pad}        continue")
        out.append(f"{pad}    elif qty >= {bq}:")
        out.append(f"{pad}        line_total = qty * price * {bm}")
        out.append(f"{pad}    else:")
        out.append(f"{pad}        line_total = qty * price * {base}")
    out.append(f"{pad}else:")
    out.append(f"{pad}    line_total = qty * price")
    return "\n".join(out)


def py_billing(n):
    return f'''"""Legacy billing engine (sample code for CodeSentinel demos)."""

TAX_RATES = {{"US": 0.07, "EU": 0.20, "IN": 0.18, "UK": 0.20, "AU": 0.10}}


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
{py_chain(n, 8)}
        if item.get("gift_wrap"):
            if category in ("book", "toys", "music"):
                line_total += 2.5 * qty
            else:
                line_total += 4.0 * qty
        lines.append({{"sku": item["sku"], "qty": qty, "total": round(line_total, 2)}})
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
    return {{"lines": lines, "subtotal": round(total, 2), "discount": round(discount, 2),
            "tax": round(tax, 2), "total": round(taxable + tax, 2), "flags": flags}}


def validate_order(order):
    errors = []
    if not order.get("items"):
        errors.append("empty order")
    for i, item in enumerate(order.get("items", [])):
        if "sku" not in item:
            errors.append(f"item {{i}}: missing sku")
        if item.get("qty", 0) <= 0:
            errors.append(f"item {{i}}: bad quantity")
        if item.get("price", 0) < 0:
            errors.append(f"item {{i}}: negative price")
    if order.get("currency") not in ("USD", "EUR", "INR", "GBP", "AUD"):
        errors.append("unsupported currency")
    return errors


def format_invoice(invoice):
    rows = [f"{{l['sku']:<12}} x{{l['qty']:<4}} {{l['total']:>10.2f}}" for l in invoice["lines"]]
    rows.append(f"{{'subtotal':<18}} {{invoice['subtotal']:>10.2f}}")
    rows.append(f"{{'discount':<18}} {{invoice['discount']:>10.2f}}")
    rows.append(f"{{'tax':<18}} {{invoice['tax']:>10.2f}}")
    rows.append(f"{{'total':<18}} {{invoice['total']:>10.2f}}")
    return "\\n".join(rows)
'''


PY_UTILS = '''"""Small, well-documented helpers (sample code for CodeSentinel demos)."""
from typing import Iterable, List, Optional


def clamp(value: float, low: float, high: float) -> float:
    """Return value limited to the inclusive range [low, high]."""
    return max(low, min(high, value))


def mean(values: Iterable[float]) -> Optional[float]:
    """Arithmetic mean, or None for an empty input."""
    data = list(values)
    return sum(data) / len(data) if data else None


def chunk(items: List, size: int) -> List[List]:
    """Split items into consecutive chunks of at most size elements."""
    if size <= 0:
        raise ValueError("size must be positive")
    return [items[i:i + size] for i in range(0, len(items), size)]


def slugify(text: str) -> str:
    """Lower-case text with words joined by single hyphens."""
    return "-".join(text.lower().split())


def is_palindrome(text: str) -> bool:
    """True when text reads the same forwards and backwards (letters only)."""
    letters = [c.lower() for c in text if c.isalnum()]
    return letters == letters[::-1]


def percent(part: float, whole: float) -> float:
    """Percentage of part in whole, 0 when whole is zero."""
    return 100.0 * part / whole if whole else 0.0


def first(items: Iterable, default=None):
    """First element of an iterable, or default."""
    for item in items:
        return item
    return default
'''

PY_BEFORE = py_billing  # legacy: one giant function

PY_AFTER = '''"""Refactored pricing: the same behaviour as the legacy version, split into small functions."""

CATEGORY_RULES = {
%s
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
''' % "\n".join(f'    "{c}": ({b}, {q}, {m}),' for c, b, q, m in CATS)


# ============================================================ JAVA
def java_chain(n):
    out = []
    for i, (cat, base, bq, bm) in enumerate(pick(n)):
        kw = "if" if i == 0 else "} else if"
        out.append(f'            {kw} (category.equals("{cat}")) {{')
        out.append(f"                if (item.isRestricted() && !customer.isVerified()) {{")
        out.append(f"                    flags.add(\"restricted:{cat}\");")
        out.append(f"                    continue;")
        out.append(f"                }} else if (qty >= {bq}) {{")
        out.append(f"                    lineTotal = qty * price * {bm};")
        out.append(f"                }} else {{")
        out.append(f"                    lineTotal = qty * price * {base};")
        out.append(f"                }}")
    out.append("            } else {")
    out.append("                lineTotal = qty * price;")
    out.append("            }")
    return "\n".join(out)


def java_processor(n):
    return f'''package shop;

import java.util.ArrayList;
import java.util.List;

/** Order pricing for the legacy shop backend (sample code for CodeSentinel demos). */
public class OrderProcessor {{

    public double priceOrder(List<Item> items, Customer customer, String region, List<String> promoCodes, List<String> flags) {{
        double total = 0.0;
        double discount = 0.0;
        for (Item item : items) {{
            int qty = item.getQty();
            if (qty <= 0) {{
                continue;
            }}
            double price = item.getPrice();
            String category = item.getCategory() == null ? "general" : item.getCategory();
            double lineTotal = qty * price;
{java_chain(n)}
            if (item.isGiftWrap()) {{
                if (category.equals("book") || category.equals("toys") || category.equals("music")) {{
                    lineTotal += 2.5 * qty;
                }} else {{
                    lineTotal += 4.0 * qty;
                }}
            }}
            total += lineTotal;
        }}

        for (String code : promoCodes) {{
            if (code.equals("WELCOME10")) {{
                if (total > 50) {{
                    discount += total * 0.10;
                }} else {{
                    discount += 5;
                }}
            }} else if (code.equals("BULK20")) {{
                if (items.size() >= 5 && total > 200) {{
                    discount += total * 0.20;
                }}
            }} else if (code.equals("LOYAL")) {{
                if (customer.getYears() >= 3) {{
                    discount += total * 0.05;
                    if (customer.getYears() >= 10) {{
                        discount += total * 0.05;
                    }}
                }}
            }} else if (code.startsWith("FLASH")) {{
                try {{
                    int pct = Integer.parseInt(code.substring(5));
                    if (pct > 0 && pct <= 50) {{
                        discount += total * pct / 100.0;
                    }}
                }} catch (NumberFormatException e) {{
                    flags.add("bad-promo:" + code);
                }}
            }}
        }}

        String tier = customer.getTier();
        if ("gold".equals(tier)) {{
            discount += total * 0.07;
        }} else if ("silver".equals(tier)) {{
            discount += total * 0.04;
        }} else if ("staff".equals(tier)) {{
            discount += total * 0.25;
        }}
        discount = Math.min(discount, total * 0.6);
        double rate = taxRate(region, customer);
        double taxable = total - discount;
        return taxable + taxable * rate;
    }}

    private double taxRate(String region, Customer customer) {{
        if ("US".equals(region)) {{
            return customer.isTaxExempt() ? 0.0 : 0.07;
        }}
        if ("EU".equals(region) || "UK".equals(region)) {{
            return 0.20;
        }}
        return "IN".equals(region) ? 0.18 : 0.0;
    }}

    public List<String> validate(List<Item> items) {{
        List<String> errors = new ArrayList<>();
        if (items == null || items.isEmpty()) {{
            errors.add("empty order");
            return errors;
        }}
        for (Item item : items) {{
            if (item.getQty() <= 0) {{
                errors.add("bad quantity for " + item.getSku());
            }}
            if (item.getPrice() < 0) {{
                errors.add("negative price for " + item.getSku());
            }}
        }}
        return errors;
    }}
}}
'''


JAVA_MONEY = '''package shop;

import java.util.Objects;

/** Immutable money amount in minor units (sample code for CodeSentinel demos). */
public final class Money implements Comparable<Money> {
    private final long minorUnits;
    private final String currency;

    public Money(long minorUnits, String currency) {
        this.minorUnits = minorUnits;
        this.currency = Objects.requireNonNull(currency);
    }

    public long getMinorUnits() {
        return minorUnits;
    }

    public String getCurrency() {
        return currency;
    }

    public Money plus(Money other) {
        requireSameCurrency(other);
        return new Money(minorUnits + other.minorUnits, currency);
    }

    public Money times(int factor) {
        return new Money(minorUnits * factor, currency);
    }

    public boolean isZero() {
        return minorUnits == 0;
    }

    private void requireSameCurrency(Money other) {
        if (!currency.equals(other.currency)) {
            throw new IllegalArgumentException("currency mismatch");
        }
    }

    @Override
    public int compareTo(Money other) {
        requireSameCurrency(other);
        return Long.compare(minorUnits, other.minorUnits);
    }

    @Override
    public String toString() {
        return String.format("%d.%02d %s", minorUnits / 100, Math.abs(minorUnits % 100), currency);
    }
}
'''

JAVA_ITEM = '''package shop;

/** Order line (sample code for CodeSentinel demos). */
public class Item {
    private final String sku;
    private final int qty;
    private final double price;
    private final String category;
    private final boolean restricted;
    private final boolean giftWrap;

    public Item(String sku, int qty, double price, String category, boolean restricted, boolean giftWrap) {
        this.sku = sku;
        this.qty = qty;
        this.price = price;
        this.category = category;
        this.restricted = restricted;
        this.giftWrap = giftWrap;
    }

    public String getSku() { return sku; }
    public int getQty() { return qty; }
    public double getPrice() { return price; }
    public String getCategory() { return category; }
    public boolean isRestricted() { return restricted; }
    public boolean isGiftWrap() { return giftWrap; }
}
'''


JAVA_CUSTOMER = '''package shop;

/** Customer pricing attributes (sample code for CodeSentinel demos). */
public class Customer {
    private final String tier;
    private final int years;
    private final boolean verified;
    private final boolean taxExempt;

    public Customer(String tier, int years, boolean verified, boolean taxExempt) {
        this.tier = tier;
        this.years = years;
        this.verified = verified;
        this.taxExempt = taxExempt;
    }

    public String getTier() { return tier; }
    public int getYears() { return years; }
    public boolean isVerified() { return verified; }
    public boolean isTaxExempt() { return taxExempt; }
}
'''


# ============================================================ C
C_PARSER = '''/* Hand-written expression tokenizer and evaluator (sample code for CodeSentinel demos). */
#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

enum token_kind { T_END, T_NUM, T_IDENT, T_OP, T_LPAREN, T_RPAREN, T_COMMA, T_ERROR };

struct token {
    enum token_kind kind;
    char text[32];
    double value;
};

int next_token(const char *src, int pos, struct token *out, int *errors, int strict, int allow_hex) {
    int start;
    int len;
    out->value = 0;
    out->text[0] = '\\0';
    while (src[pos] == ' ' || src[pos] == '\\t' || src[pos] == '\\n') {
        pos++;
    }
    if (src[pos] == '\\0') {
        out->kind = T_END;
        return pos;
    }
    if (isdigit((unsigned char)src[pos]) || (src[pos] == '.' && isdigit((unsigned char)src[pos + 1]))) {
        start = pos;
        if (allow_hex && src[pos] == '0' && (src[pos + 1] == 'x' || src[pos + 1] == 'X')) {
            pos += 2;
            while (isxdigit((unsigned char)src[pos])) {
                pos++;
            }
            len = pos - start;
            if (len >= (int)sizeof(out->text)) {
                if (strict) {
                    (*errors)++;
                    out->kind = T_ERROR;
                    return pos;
                }
                len = (int)sizeof(out->text) - 1;
            }
            memcpy(out->text, src + start, len);
            out->text[len] = '\\0';
            out->value = (double)strtol(out->text, NULL, 16);
            out->kind = T_NUM;
            return pos;
        }
        while (isdigit((unsigned char)src[pos]) || src[pos] == '.') {
            pos++;
        }
        if (src[pos] == 'e' || src[pos] == 'E') {
            pos++;
            if (src[pos] == '+' || src[pos] == '-') {
                pos++;
            }
            while (isdigit((unsigned char)src[pos])) {
                pos++;
            }
        }
        len = pos - start;
        if (len >= (int)sizeof(out->text)) {
            len = (int)sizeof(out->text) - 1;
        }
        memcpy(out->text, src + start, len);
        out->text[len] = '\\0';
        out->value = atof(out->text);
        out->kind = T_NUM;
        return pos;
    }
    if (isalpha((unsigned char)src[pos]) || src[pos] == '_') {
        start = pos;
        while (isalnum((unsigned char)src[pos]) || src[pos] == '_') {
            pos++;
        }
        len = pos - start;
        if (len >= (int)sizeof(out->text)) {
            len = (int)sizeof(out->text) - 1;
        }
        memcpy(out->text, src + start, len);
        out->text[len] = '\\0';
        out->kind = T_IDENT;
        return pos;
    }
    switch (src[pos]) {
    case '+': case '-': case '*': case '/': case '%': case '^':
        out->kind = T_OP; out->text[0] = src[pos]; out->text[1] = '\\0';
        return pos + 1;
    case '<': case '>': case '=': case '!':
        out->kind = T_OP; out->text[0] = src[pos];
        if (src[pos + 1] == '=') {
            out->text[1] = '='; out->text[2] = '\\0';
            return pos + 2;
        }
        out->text[1] = '\\0';
        return pos + 1;
    case '&':
        if (src[pos + 1] == '&') { out->kind = T_OP; strcpy(out->text, "&&"); return pos + 2; }
        break;
    case '|':
        if (src[pos + 1] == '|') { out->kind = T_OP; strcpy(out->text, "||"); return pos + 2; }
        break;
    case '(':
        out->kind = T_LPAREN; return pos + 1;
    case ')':
        out->kind = T_RPAREN; return pos + 1;
    case ',':
        out->kind = T_COMMA; return pos + 1;
    default:
        break;
    }
    (*errors)++;
    out->kind = T_ERROR;
    out->text[0] = src[pos];
    out->text[1] = '\\0';
    return pos + 1;
}

int precedence(const char *op) {
    if (strcmp(op, "||") == 0) return 1;
    if (strcmp(op, "&&") == 0) return 2;
    if (strcmp(op, "==") == 0 || strcmp(op, "!=") == 0) return 3;
    if (op[0] == '<' || op[0] == '>') return 4;
    if (op[0] == '+' || op[0] == '-') return 5;
    if (op[0] == '*' || op[0] == '/' || op[0] == '%') return 6;
    if (op[0] == '^') return 7;
    return 0;
}

int is_right_assoc(const char *op) {
    return op[0] == '^';
}
'''

C_VECTOR = '''/* Tiny growable int vector (sample code for CodeSentinel demos). */
#include <stdlib.h>

struct vec {
    int *data;
    int len;
    int cap;
};

void vec_init(struct vec *v) {
    v->data = NULL;
    v->len = 0;
    v->cap = 0;
}

int vec_push(struct vec *v, int value) {
    if (v->len == v->cap) {
        int ncap = v->cap ? v->cap * 2 : 8;
        int *n = realloc(v->data, (size_t)ncap * sizeof(int));
        if (!n) {
            return -1;
        }
        v->data = n;
        v->cap = ncap;
    }
    v->data[v->len++] = value;
    return 0;
}

int vec_get(const struct vec *v, int index) {
    return v->data[index];
}

int vec_sum(const struct vec *v) {
    int total = 0;
    for (int i = 0; i < v->len; i++) {
        total += v->data[i];
    }
    return total;
}

void vec_free(struct vec *v) {
    free(v->data);
    vec_init(v);
}
'''


# ============================================================ C++
def cpp_chain(n):
    out = []
    for i, (cat, base, bq, bm) in enumerate(pick(n)):
        kw = "if" if i == 0 else "} else if"
        out.append(f'        {kw} (job.kind == "{cat}") {{')
        out.append(f"            if (job.restricted && !ctx.verified) {{")
        out.append(f"                ctx.skipped.push_back(job.id);")
        out.append(f"                continue;")
        out.append(f"            }} else if (job.size >= {bq}) {{")
        out.append(f"                cost = job.size * job.unit_cost * {bm};")
        out.append(f"            }} else {{")
        out.append(f"                cost = job.size * job.unit_cost * {base};")
        out.append(f"            }}")
    out.append("        } else {")
    out.append("            cost = job.size * job.unit_cost;")
    out.append("        }")
    return "\n".join(out)


def cpp_scheduler(n):
    return f'''// Batch scheduler with a growing rule chain (sample code for CodeSentinel demos).
#include <algorithm>
#include <string>
#include <vector>

struct Job {{
    int id;
    std::string kind;
    int size;
    double unit_cost;
    bool restricted;
    int priority;
}};

struct Context {{
    bool verified;
    int budget;
    std::vector<int> skipped;
}};

double plan_batch(std::vector<Job> &jobs, Context &ctx, int workers, bool urgent) {{
    double total = 0.0;
    std::sort(jobs.begin(), jobs.end(), [](const Job &a, const Job &b) {{ return a.priority > b.priority; }});
    for (const Job &job : jobs) {{
        if (job.size <= 0) {{
            continue;
        }}
        double cost = job.size * job.unit_cost;
{cpp_chain(n)}
        if (urgent) {{
            if (job.priority > 5) {{
                cost *= 1.5;
            }} else {{
                cost *= 1.2;
            }}
        }}
        if (workers > 1 && job.size > 100) {{
            cost = cost / std::min(workers, 4);
        }}
        if (total + cost > ctx.budget) {{
            ctx.skipped.push_back(job.id);
            continue;
        }}
        total += cost;
    }}
    return total;
}}

int count_urgent(const std::vector<Job> &jobs) {{
    int n = 0;
    for (const Job &j : jobs) {{
        if (j.priority > 5) {{
            n++;
        }}
    }}
    return n;
}}
'''


CPP_MATRIX = '''// Small dense matrix helper (sample code for CodeSentinel demos).
#include <stdexcept>
#include <vector>

class Matrix {
public:
    Matrix(int rows, int cols) : rows_(rows), cols_(cols), data_(rows * cols, 0.0) {}

    int rows() const { return rows_; }
    int cols() const { return cols_; }

    double &at(int r, int c) { return data_[r * cols_ + c]; }
    double at(int r, int c) const { return data_[r * cols_ + c]; }

    Matrix transpose() const {
        Matrix t(cols_, rows_);
        for (int r = 0; r < rows_; r++) {
            for (int c = 0; c < cols_; c++) {
                t.at(c, r) = at(r, c);
            }
        }
        return t;
    }

    Matrix multiply(const Matrix &other) const {
        if (cols_ != other.rows_) {
            throw std::invalid_argument("dimension mismatch");
        }
        Matrix out(rows_, other.cols_);
        for (int i = 0; i < rows_; i++) {
            for (int j = 0; j < other.cols_; j++) {
                double sum = 0.0;
                for (int k = 0; k < cols_; k++) {
                    sum += at(i, k) * other.at(k, j);
                }
                out.at(i, j) = sum;
            }
        }
        return out;
    }

private:
    int rows_;
    int cols_;
    std::vector<double> data_;
};
'''


# ============================================================ JavaScript
def js_chain(n, ts=False):
    out = []
    for i, (cat, base, bq, bm) in enumerate(pick(n)):
        kw = "if" if i == 0 else "} else if"
        out.append(f'    {kw} (category === "{cat}") {{')
        out.append(f"      if (item.restricted && !customer.verified) {{")
        out.append(f"        flags.push(\"restricted:{cat}\");")
        out.append(f"        continue;")
        out.append(f"      }} else if (qty >= {bq}) {{")
        out.append(f"        lineTotal = qty * price * {bm};")
        out.append(f"      }} else {{")
        out.append(f"        lineTotal = qty * price * {base};")
        out.append(f"      }}")
    out.append("    } else {")
    out.append("      lineTotal = qty * price;")
    out.append("    }")
    return "\n".join(out)


def js_cart(n):
    return f'''// Shopping cart pricing (sample code for CodeSentinel demos).
"use strict";

const TAX = {{ US: 0.07, EU: 0.2, IN: 0.18, UK: 0.2 }};

function priceCart(items, customer, region, promoCodes, flags) {{
  let total = 0;
  let discount = 0;
  for (const item of items) {{
    const qty = item.qty || 0;
    if (qty <= 0) {{
      continue;
    }}
    const price = item.price;
    const category = item.category || "general";
    let lineTotal = qty * price;
{js_chain(n)}
    if (item.giftWrap) {{
      if (category === "book" || category === "toys" || category === "music") {{
        lineTotal += 2.5 * qty;
      }} else {{
        lineTotal += 4 * qty;
      }}
    }}
    total += lineTotal;
  }}

  for (const code of promoCodes) {{
    if (code === "WELCOME10") {{
      if (total > 50) {{
        discount += total * 0.1;
      }} else {{
        discount += 5;
      }}
    }} else if (code === "BULK20") {{
      if (items.length >= 5 && total > 200) {{
        discount += total * 0.2;
      }}
    }} else if (code === "LOYAL") {{
      if (customer.years >= 3) {{
        discount += total * 0.05;
        if (customer.years >= 10) {{
          discount += total * 0.05;
        }}
      }}
    }} else if (code.startsWith("FLASH")) {{
      const pct = parseInt(code.slice(5), 10);
      if (!Number.isNaN(pct) && pct > 0 && pct <= 50) {{
        discount += (total * pct) / 100;
      }}
    }}
  }}

  if (customer.tier === "gold") {{
    discount += total * 0.07;
  }} else if (customer.tier === "silver") {{
    discount += total * 0.04;
  }} else if (customer.tier === "staff") {{
    discount += total * 0.25;
  }}
  discount = Math.min(discount, total * 0.6);
  const taxable = total - discount;
  const rate = region === "US" && customer.taxExempt ? 0 : TAX[region] || 0;
  return {{ subtotal: total, discount, tax: taxable * rate, total: taxable * (1 + rate), flags }};
}}

function validateCart(items) {{
  const errors = [];
  if (!Array.isArray(items) || items.length === 0) {{
    errors.push("empty cart");
    return errors;
  }}
  items.forEach((item, i) => {{
    if (!item.sku) errors.push(`item ${{i}}: missing sku`);
    if (!(item.qty > 0)) errors.push(`item ${{i}}: bad quantity`);
    if (item.price < 0) errors.push(`item ${{i}}: negative price`);
  }});
  return errors;
}}

module.exports = {{ priceCart, validateCart }};
'''


JS_FORMAT = '''// Formatting helpers (sample code for CodeSentinel demos).
"use strict";

function money(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function pad(value, width, ch = " ") {
  return String(value).padStart(width, ch);
}

function truncate(text, max) {
  return text.length <= max ? text : text.slice(0, max - 1) + "\\u2026";
}

function titleCase(text) {
  return text.replace(/\\w\\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

function sum(values) {
  return values.reduce((a, b) => a + b, 0);
}

function groupBy(items, keyFn) {
  const out = {};
  for (const item of items) {
    const key = keyFn(item);
    (out[key] = out[key] || []).push(item);
  }
  return out;
}

module.exports = { money, pad, truncate, titleCase, sum, groupBy };
'''


# ============================================================ TypeScript
def ts_chain(n):
    out = []
    for i, (cat, base, bq, bm) in enumerate(pick(n)):
        kw = "if" if i == 0 else "} else if"
        out.append(f'    {kw} (category === "{cat}") {{')
        out.append(f"      if (item.restricted && !customer.verified) {{")
        out.append(f"        flags.push(\"restricted:{cat}\");")
        out.append(f"        continue;")
        out.append(f"      }} else if (qty >= {bq}) {{")
        out.append(f"        lineTotal = qty * price * {bm};")
        out.append(f"      }} else {{")
        out.append(f"        lineTotal = qty * price * {base};")
        out.append(f"      }}")
    out.append("    } else {")
    out.append("      lineTotal = qty * price;")
    out.append("    }")
    return "\n".join(out)


def ts_pricing(n):
    return f'''// Pricing engine (sample code for CodeSentinel demos).
export interface Item {{
  sku: string;
  qty: number;
  price: number;
  category?: string;
  restricted?: boolean;
}}

export interface Customer {{
  tier: "standard" | "silver" | "gold" | "staff";
  years: number;
  verified: boolean;
}}

export function priceItems(
  items: Item[],
  customer: Customer,
  region: string,
  promoCodes: string[],
  flags: string[],
): number {{
  let total = 0;
  let discount = 0;
  for (const item of items) {{
    const qty = item.qty;
    if (qty <= 0) {{
      continue;
    }}
    const price = item.price;
    const category = item.category ?? "general";
    let lineTotal = qty * price;
{ts_chain(n)}
    total += lineTotal;
  }}
  for (const code of promoCodes) {{
    if (code === "WELCOME10") {{
      discount += total > 50 ? total * 0.1 : 5;
    }} else if (code === "BULK20") {{
      if (items.length >= 5 && total > 200) {{
        discount += total * 0.2;
      }}
    }} else if (code === "LOYAL" && customer.years >= 3) {{
      discount += total * (customer.years >= 10 ? 0.1 : 0.05);
    }}
  }}
  if (customer.tier === "gold") {{
    discount += total * 0.07;
  }} else if (customer.tier === "silver") {{
    discount += total * 0.04;
  }} else if (customer.tier === "staff") {{
    discount += total * 0.25;
  }}
  discount = Math.min(discount, total * 0.6);
  const rate = region === "US" ? 0.07 : region === "IN" ? 0.18 : 0.2;
  return (total - discount) * (1 + rate);
}}
'''


TS_VALIDATORS = '''// Input validators (sample code for CodeSentinel demos).
export type Result = { ok: true } | { ok: false; reason: string };

export function isEmail(value: string): boolean {
  return /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(value);
}

export function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

export function nonEmpty(value: string): Result {
  return value.trim().length > 0 ? { ok: true } : { ok: false, reason: "empty" };
}

export function maxLength(value: string, limit: number): Result {
  return value.length <= limit ? { ok: true } : { ok: false, reason: `longer than ${limit}` };
}

export function oneOf<T>(value: T, allowed: readonly T[]): boolean {
  return allowed.includes(value);
}

export function firstError(results: Result[]): string | null {
  for (const r of results) {
    if (!r.ok) {
      return r.reason;
    }
  }
  return null;
}
'''


# ============================================================ Go
def go_chain(n):
    out = []
    for i, (cat, base, bq, bm) in enumerate(pick(n)):
        kw = "if" if i == 0 else "} else if"
        out.append(f'\t\t{kw} category == "{cat}" {{')
        out.append(f"\t\t\tif item.Restricted && !c.Verified {{")
        out.append(f"\t\t\t\tflags = append(flags, \"restricted:{cat}\")")
        out.append(f"\t\t\t\tcontinue")
        out.append(f"\t\t\t}} else if qty >= {bq} {{")
        out.append(f"\t\t\t\tlineTotal = float64(qty) * item.Price * {bm}")
        out.append(f"\t\t\t}} else {{")
        out.append(f"\t\t\t\tlineTotal = float64(qty) * item.Price * {base}")
        out.append(f"\t\t\t}}")
    out.append("\t\t} else {")
    out.append("\t\t\tlineTotal = float64(qty) * item.Price")
    out.append("\t\t}")
    return "\n".join(out)


def go_router(n):
    return f'''// Package router prices shipments with a growing rule chain (sample code for CodeSentinel demos).
package router

// Item is one shipment line.
type Item struct {{
	SKU        string
	Qty        int
	Price      float64
	Category   string
	Restricted bool
}}

// Customer holds pricing attributes.
type Customer struct {{
	Tier     string
	Years    int
	Verified bool
}}

// PriceShipment totals the items with category, promo and tier rules.
func PriceShipment(items []Item, c Customer, region string, promos []string, flags []string) (float64, []string) {{
	total := 0.0
	discount := 0.0
	for _, item := range items {{
		qty := item.Qty
		if qty <= 0 {{
			continue
		}}
		category := item.Category
		if category == "" {{
			category = "general"
		}}
		lineTotal := float64(qty) * item.Price
{go_chain(n)}
		total += lineTotal
	}}
	for _, code := range promos {{
		if code == "WELCOME10" {{
			if total > 50 {{
				discount += total * 0.10
			}} else {{
				discount += 5
			}}
		}} else if code == "BULK20" {{
			if len(items) >= 5 && total > 200 {{
				discount += total * 0.20
			}}
		}} else if code == "LOYAL" {{
			if c.Years >= 3 {{
				discount += total * 0.05
				if c.Years >= 10 {{
					discount += total * 0.05
				}}
			}}
		}}
	}}
	switch c.Tier {{
	case "gold":
		discount += total * 0.07
	case "silver":
		discount += total * 0.04
	case "staff":
		discount += total * 0.25
	}}
	if discount > total*0.6 {{
		discount = total * 0.6
	}}
	rate := 0.2
	if region == "US" {{
		rate = 0.07
	}} else if region == "IN" {{
		rate = 0.18
	}}
	return (total - discount) * (1 + rate), flags
}}
'''


GO_STATS = '''// Package mathx has small numeric helpers (sample code for CodeSentinel demos).
package mathx

import (
	"math"
	"sort"
)

// Mean returns the arithmetic mean, or 0 for an empty slice.
func Mean(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

// Median returns the middle value of the slice.
func Median(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	cp := append([]float64(nil), values...)
	sort.Float64s(cp)
	mid := len(cp) / 2
	if len(cp)%2 == 0 {
		return (cp[mid-1] + cp[mid]) / 2
	}
	return cp[mid]
}

// StdDev returns the population standard deviation.
func StdDev(values []float64) float64 {
	m := Mean(values)
	acc := 0.0
	for _, v := range values {
		acc += (v - m) * (v - m)
	}
	return math.Sqrt(acc / float64(len(values)))
}

// Clamp limits v to [lo, hi].
func Clamp(v, lo, hi float64) float64 {
	return math.Max(lo, math.Min(hi, v))
}
'''


# ============================================================ C#
def cs_chain(n):
    out = []
    for i, (cat, base, bq, bm) in enumerate(pick(n)):
        kw = "if" if i == 0 else "} else if"
        out.append(f'            {kw} (category == "{cat}")')
        out.append("            {")
        out.append(f"                if (item.Restricted && !customer.Verified)")
        out.append("                {")
        out.append(f"                    flags.Add(\"restricted:{cat}\");")
        out.append(f"                    continue;")
        out.append("                }")
        out.append(f"                else if (qty >= {bq})")
        out.append("                {")
        out.append(f"                    lineTotal = qty * item.Price * {bm}m;")
        out.append("                }")
        out.append("                else")
        out.append("                {")
        out.append(f"                    lineTotal = qty * item.Price * {base}m;")
        out.append("                }")
    out.append("            } else {")
    out.append("                lineTotal = qty * item.Price;")
    out.append("            }")
    text = "\n".join(out).replace("} else if", "}\n            else if").replace("            } else {", "            }\n            else\n            {")
    return "\n".join("    " + line for line in text.split("\n"))


def cs_invoice(n):
    return f'''using System;
using System.Collections.Generic;

namespace Billing.Services
{{
    /// <summary>Invoice totals for the legacy billing service (sample code for CodeSentinel demos).</summary>
    public class InvoiceService
    {{
        public decimal Calculate(IList<LineItem> items, Customer customer, string region, IList<string> promoCodes, IList<string> flags)
        {{
            decimal total = 0m;
            decimal discount = 0m;
            foreach (var item in items)
            {{
                int qty = item.Qty;
                if (qty <= 0)
                {{
                    continue;
                }}
                string category = item.Category ?? "general";
                decimal lineTotal = qty * item.Price;
{cs_chain(n)}
                if (item.GiftWrap)
                {{
                    if (category == "book" || category == "toys" || category == "music")
                    {{
                        lineTotal += 2.5m * qty;
                    }}
                    else
                    {{
                        lineTotal += 4m * qty;
                    }}
                }}
                total += lineTotal;
            }}

            foreach (var code in promoCodes)
            {{
                if (code == "WELCOME10")
                {{
                    discount += total > 50 ? total * 0.10m : 5m;
                }}
                else if (code == "BULK20")
                {{
                    if (items.Count >= 5 && total > 200)
                    {{
                        discount += total * 0.20m;
                    }}
                }}
                else if (code == "LOYAL")
                {{
                    if (customer.Years >= 3)
                    {{
                        discount += total * 0.05m;
                        if (customer.Years >= 10)
                        {{
                            discount += total * 0.05m;
                        }}
                    }}
                }}
                else if (code.StartsWith("FLASH"))
                {{
                    int pct;
                    if (int.TryParse(code.Substring(5), out pct) && pct > 0 && pct <= 50)
                    {{
                        discount += total * pct / 100m;
                    }}
                }}
            }}

            switch (customer.Tier)
            {{
                case "gold": discount += total * 0.07m; break;
                case "silver": discount += total * 0.04m; break;
                case "staff": discount += total * 0.25m; break;
            }}
            discount = Math.Min(discount, total * 0.6m);
            decimal rate = region == "US" ? 0.07m : region == "IN" ? 0.18m : 0.20m;
            return (total - discount) * (1 + rate);
        }}
    }}

    public class LineItem
    {{
        public int Qty {{ get; set; }}
        public decimal Price {{ get; set; }}
        public string Category {{ get; set; }}
        public bool Restricted {{ get; set; }}
        public bool GiftWrap {{ get; set; }}
    }}

    public class Customer
    {{
        public string Tier {{ get; set; }}
        public int Years {{ get; set; }}
        public bool Verified {{ get; set; }}
    }}
}}
'''


CS_CUSTOMER = '''using System;

namespace Billing.Models
{
    /// <summary>Customer record with small, focused members (sample code for CodeSentinel demos).</summary>
    public class CustomerRecord
    {
        public string Id { get; }
        public string Name { get; private set; }
        public string Email { get; private set; }
        public DateTime Joined { get; }

        public CustomerRecord(string id, string name, string email, DateTime joined)
        {
            Id = id;
            Name = name;
            Email = email;
            Joined = joined;
        }

        public int YearsSinceJoined(DateTime now)
        {
            return (int)((now - Joined).TotalDays / 365.25);
        }

        public void Rename(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                throw new ArgumentException("name required");
            }
            Name = name.Trim();
        }

        public bool HasValidEmail()
        {
            return Email != null && Email.Contains("@") && Email.IndexOf('.') > Email.IndexOf('@');
        }

        public override string ToString()
        {
            return Id + ": " + Name;
        }
    }
}
'''


SHIP = {'py': '\n\ndef estimate_shipping(order, region, express=False, insured=False):\n    weight = 0.0\n    for item in order["items"]:\n        qty = item.get("qty", 0)\n        if qty <= 0:\n            continue\n        w = item.get("weight", 0.5)\n        if item.get("fragile"):\n            w *= 1.3\n        weight += w * qty\n    if region == "US":\n        base = 5.0 if weight <= 1 else 5.0 + (weight - 1) * 1.2\n    elif region in ("EU", "UK"):\n        base = 9.0 if weight <= 1 else 9.0 + (weight - 1) * 1.8\n    elif region == "IN":\n        base = 4.0 if weight <= 2 else 4.0 + (weight - 2) * 0.9\n    else:\n        base = 15.0 + weight * 2.5\n    if express:\n        base *= 1.8 if region in ("US", "IN") else 2.2\n    if insured:\n        base += max(2.0, order.get("value", 0) * 0.01)\n    if weight > 30:\n        base += 25\n    return round(base, 2)\n', 'java': '\n    public double estimateShipping(List<Item> items, String region, boolean express, boolean insured, double value) {\n        double weight = 0.0;\n        for (Item item : items) {\n            if (item.getQty() <= 0) {\n                continue;\n            }\n            double w = item.isRestricted() ? 1.3 : 1.0;\n            weight += w * item.getQty() * 0.5;\n        }\n        double base;\n        if (region.equals("US")) {\n            base = weight <= 1 ? 5.0 : 5.0 + (weight - 1) * 1.2;\n        } else if (region.equals("EU") || region.equals("UK")) {\n            base = weight <= 1 ? 9.0 : 9.0 + (weight - 1) * 1.8;\n        } else if (region.equals("IN")) {\n            base = weight <= 2 ? 4.0 : 4.0 + (weight - 2) * 0.9;\n        } else {\n            base = 15.0 + weight * 2.5;\n        }\n        if (express) {\n            base *= (region.equals("US") || region.equals("IN")) ? 1.8 : 2.2;\n        }\n        if (insured) {\n            base += Math.max(2.0, value * 0.01);\n        }\n        if (weight > 30) {\n            base += 25;\n        }\n        return Math.round(base * 100.0) / 100.0;\n    }\n', 'cpp': '\ndouble estimate_shipping(const std::vector<Job> &jobs, const std::string &region, bool express, bool insured, double value) {\n    double weight = 0.0;\n    for (const Job &job : jobs) {\n        if (job.size <= 0) {\n            continue;\n        }\n        double w = job.restricted ? 1.3 : 1.0;\n        weight += w * job.size * 0.5;\n    }\n    double base;\n    if (region == "US") {\n        base = weight <= 1 ? 5.0 : 5.0 + (weight - 1) * 1.2;\n    } else if (region == "EU" || region == "UK") {\n        base = weight <= 1 ? 9.0 : 9.0 + (weight - 1) * 1.8;\n    } else if (region == "IN") {\n        base = weight <= 2 ? 4.0 : 4.0 + (weight - 2) * 0.9;\n    } else {\n        base = 15.0 + weight * 2.5;\n    }\n    if (express) {\n        base *= (region == "US" || region == "IN") ? 1.8 : 2.2;\n    }\n    if (insured) {\n        base += std::max(2.0, value * 0.01);\n    }\n    if (weight > 30) {\n        base += 25;\n    }\n    return base;\n}\n', 'js': '\nfunction estimateShipping(items, region, express, insured, value) {\n  let weight = 0;\n  for (const item of items) {\n    if (!(item.qty > 0)) {\n      continue;\n    }\n    const w = item.fragile ? 1.3 : 1;\n    weight += w * item.qty * 0.5;\n  }\n  let base;\n  if (region === "US") {\n    base = weight <= 1 ? 5 : 5 + (weight - 1) * 1.2;\n  } else if (region === "EU" || region === "UK") {\n    base = weight <= 1 ? 9 : 9 + (weight - 1) * 1.8;\n  } else if (region === "IN") {\n    base = weight <= 2 ? 4 : 4 + (weight - 2) * 0.9;\n  } else {\n    base = 15 + weight * 2.5;\n  }\n  if (express) {\n    base *= region === "US" || region === "IN" ? 1.8 : 2.2;\n  }\n  if (insured) {\n    base += Math.max(2, value * 0.01);\n  }\n  if (weight > 30) {\n    base += 25;\n  }\n  return Math.round(base * 100) / 100;\n}\n', 'ts': '\nexport function estimateShipping(items: Item[], region: string, express: boolean, insured: boolean, value: number): number {\n  let weight = 0;\n  for (const item of items) {\n    if (item.qty <= 0) {\n      continue;\n    }\n    const w = item.restricted ? 1.3 : 1;\n    weight += w * item.qty * 0.5;\n  }\n  let base: number;\n  if (region === "US") {\n    base = weight <= 1 ? 5 : 5 + (weight - 1) * 1.2;\n  } else if (region === "EU" || region === "UK") {\n    base = weight <= 1 ? 9 : 9 + (weight - 1) * 1.8;\n  } else if (region === "IN") {\n    base = weight <= 2 ? 4 : 4 + (weight - 2) * 0.9;\n  } else {\n    base = 15 + weight * 2.5;\n  }\n  if (express) {\n    base *= region === "US" || region === "IN" ? 1.8 : 2.2;\n  }\n  if (insured) {\n    base += Math.max(2, value * 0.01);\n  }\n  if (weight > 30) {\n    base += 25;\n  }\n  return Math.round(base * 100) / 100;\n}\n', 'go': '\n// EstimateShipping prices delivery by weight, region and options.\nfunc EstimateShipping(items []Item, region string, express bool, insured bool, value float64) float64 {\n\tweight := 0.0\n\tfor _, item := range items {\n\t\tif item.Qty <= 0 {\n\t\t\tcontinue\n\t\t}\n\t\tw := 1.0\n\t\tif item.Restricted {\n\t\t\tw = 1.3\n\t\t}\n\t\tweight += w * float64(item.Qty) * 0.5\n\t}\n\tvar base float64\n\tif region == "US" {\n\t\tbase = 5.0\n\t\tif weight > 1 {\n\t\t\tbase = 5.0 + (weight-1)*1.2\n\t\t}\n\t} else if region == "EU" || region == "UK" {\n\t\tbase = 9.0\n\t\tif weight > 1 {\n\t\t\tbase = 9.0 + (weight-1)*1.8\n\t\t}\n\t} else if region == "IN" {\n\t\tbase = 4.0\n\t\tif weight > 2 {\n\t\t\tbase = 4.0 + (weight-2)*0.9\n\t\t}\n\t} else {\n\t\tbase = 15.0 + weight*2.5\n\t}\n\tif express {\n\t\tif region == "US" || region == "IN" {\n\t\t\tbase *= 1.8\n\t\t} else {\n\t\t\tbase *= 2.2\n\t\t}\n\t}\n\tif insured && value*0.01 > 2.0 {\n\t\tbase += value * 0.01\n\t} else if insured {\n\t\tbase += 2.0\n\t}\n\tif weight > 30 {\n\t\tbase += 25\n\t}\n\treturn base\n}\n', 'cs': '\n        public decimal EstimateShipping(IList<LineItem> items, string region, bool express, bool insured, decimal value)\n        {\n            decimal weight = 0m;\n            foreach (var item in items)\n            {\n                if (item.Qty <= 0)\n                {\n                    continue;\n                }\n                decimal w = item.Restricted ? 1.3m : 1m;\n                weight += w * item.Qty * 0.5m;\n            }\n            decimal baseCost;\n            if (region == "US")\n            {\n                baseCost = weight <= 1 ? 5m : 5m + (weight - 1) * 1.2m;\n            }\n            else if (region == "EU" || region == "UK")\n            {\n                baseCost = weight <= 1 ? 9m : 9m + (weight - 1) * 1.8m;\n            }\n            else if (region == "IN")\n            {\n                baseCost = weight <= 2 ? 4m : 4m + (weight - 2) * 0.9m;\n            }\n            else\n            {\n                baseCost = 15m + weight * 2.5m;\n            }\n            if (express)\n            {\n                baseCost *= (region == "US" || region == "IN") ? 1.8m : 2.2m;\n            }\n            if (insured)\n            {\n                baseCost += Math.Max(2m, value * 0.01m);\n            }\n            if (weight > 30)\n            {\n                baseCost += 25m;\n            }\n            return Math.Round(baseCost, 2);\n        }\n'}


# ============================================================ assemble
def with_ship(kind, text):
    """Insert the shipping estimator into a generated source file."""
    ship = SHIP[kind]
    if kind == "py":
        return text.rstrip("\n") + "\n" + ship
    if kind == "java":   # inside the class, before its closing brace
        i = text.rstrip().rfind("}")
        return text[:i] + ship + "}\n"
    if kind == "cs":     # inside InvoiceService, before the class closing brace (first "    }" at 4 spaces)
        marker = "    }\n\n    public class LineItem"
        return text.replace(marker, ship + marker, 1)
    return text.rstrip("\n") + "\n" + ship


def build():
    OUT.mkdir(parents=True, exist_ok=True)
    for child in OUT.iterdir():
        if child.is_dir() and (re.match(r"\d\d_", child.name) or child.name == "zips"):
            shutil.rmtree(child)
    P = {}

    P["01_python_clean_toolkit"] = {"toolkit/helpers.py": PY_UTILS}
    P["02_python_legacy_billing"] = {"billing/billing.py": with_ship("py", py_billing(16)), "billing/helpers.py": PY_UTILS}
    P["03_java_shop"] = {"src/main/java/shop/OrderProcessor.java": with_ship("java", java_processor(14)),
                         "src/main/java/shop/Money.java": JAVA_MONEY, "src/main/java/shop/Item.java": JAVA_ITEM,
                         "src/main/java/shop/Customer.java": JAVA_CUSTOMER}
    P["04_c_expression_parser"] = {"src/tokenizer.c": C_PARSER, "src/vector.c": C_VECTOR}
    P["05_cpp_batch_scheduler"] = {"src/scheduler.cpp": with_ship("cpp", cpp_scheduler(12)), "src/matrix.cpp": CPP_MATRIX}
    P["06_javascript_cart"] = {"src/cart.js": with_ship("js", js_cart(14)).replace("module.exports = { priceCart, validateCart };", "") + "\nmodule.exports = { priceCart, validateCart, estimateShipping };\n", "src/format.js": JS_FORMAT}
    P["07_typescript_pricing"] = {"src/pricing.ts": with_ship("ts", ts_pricing(10)), "src/validators.ts": TS_VALIDATORS}
    P["08_go_router"] = {"internal/router/router.go": with_ship("go", go_router(12)), "internal/mathx/stats.go": GO_STATS}
    P["09_csharp_invoicing"] = {"Services/InvoiceService.cs": with_ship("cs", cs_invoice(12)), "Models/CustomerRecord.cs": CS_CUSTOMER}
    P["10_polyglot_demo"] = {
        "python/billing.py": with_ship("py", py_billing(8)), "python/helpers.py": PY_UTILS,
        "java/OrderProcessor.java": with_ship("java", java_processor(8)), "java/Money.java": JAVA_MONEY,
        "java/Item.java": JAVA_ITEM, "java/Customer.java": JAVA_CUSTOMER,
        "c/tokenizer.c": C_PARSER, "c/vector.c": C_VECTOR,
        "cpp/scheduler.cpp": with_ship("cpp", cpp_scheduler(6)), "cpp/matrix.cpp": CPP_MATRIX,
        "js/cart.js": with_ship("js", js_cart(8)).replace("module.exports = { priceCart, validateCart };", "") + "\nmodule.exports = { priceCart, validateCart, estimateShipping };\n", "js/format.js": JS_FORMAT,
        "ts/pricing.ts": with_ship("ts", ts_pricing(6)), "ts/validators.ts": TS_VALIDATORS,
        "go/router.go": with_ship("go", go_router(6)), "go/stats.go": GO_STATS,
        "csharp/InvoiceService.cs": with_ship("cs", cs_invoice(6)), "csharp/CustomerRecord.cs": CS_CUSTOMER,
    }
    P["11_refactor_before"] = {"pricing/pricing.py": py_billing(16)}
    P["12_refactor_after"] = {"pricing/pricing.py": PY_AFTER}

    (OUT / "zips").mkdir()
    for name, mapping in P.items():
        root = OUT / name
        files(root, mapping)
        zpath = OUT / "zips" / f"{name}.zip"
        with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
            for f in sorted(root.rglob("*")):
                if f.is_file():
                    z.write(f, f.relative_to(root))
        print(f"{name:28s} {len(mapping):2d} files  {zpath.stat().st_size:6d} bytes")


build()
