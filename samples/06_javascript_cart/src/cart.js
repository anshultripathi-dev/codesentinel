// Shopping cart pricing (sample code for CodeSentinel demos).
"use strict";

const TAX = { US: 0.07, EU: 0.2, IN: 0.18, UK: 0.2 };

function priceCart(items, customer, region, promoCodes, flags) {
  let total = 0;
  let discount = 0;
  for (const item of items) {
    const qty = item.qty || 0;
    if (qty <= 0) {
      continue;
    }
    const price = item.price;
    const category = item.category || "general";
    let lineTotal = qty * price;
    if (category === "book") {
      if (item.restricted && !customer.verified) {
        flags.push("restricted:book");
        continue;
      } else if (qty >= 10) {
        lineTotal = qty * price * 0.8;
      } else {
        lineTotal = qty * price * 0.9;
      }
    } else if (category === "food") {
      if (item.restricted && !customer.verified) {
        flags.push("restricted:food");
        continue;
      } else if (qty >= 24) {
        lineTotal = qty * price * 0.88;
      } else {
        lineTotal = qty * price * 1.05;
      }
    } else if (category === "drink") {
      if (item.restricted && !customer.verified) {
        flags.push("restricted:drink");
        continue;
      } else if (qty >= 12) {
        lineTotal = qty * price * 0.9;
      } else {
        lineTotal = qty * price * 1.0;
      }
    } else if (category === "electronics") {
      if (item.restricted && !customer.verified) {
        flags.push("restricted:electronics");
        continue;
      } else if (qty >= 3) {
        lineTotal = qty * price * 0.95;
      } else {
        lineTotal = qty * price * 1.0;
      }
    } else if (category === "clothing") {
      if (item.restricted && !customer.verified) {
        flags.push("restricted:clothing");
        continue;
      } else if (qty >= 5) {
        lineTotal = qty * price * 0.85;
      } else {
        lineTotal = qty * price * 0.95;
      }
    } else if (category === "toys") {
      if (item.restricted && !customer.verified) {
        flags.push("restricted:toys");
        continue;
      } else if (qty >= 6) {
        lineTotal = qty * price * 0.9;
      } else {
        lineTotal = qty * price * 0.97;
      }
    } else if (category === "furniture") {
      if (item.restricted && !customer.verified) {
        flags.push("restricted:furniture");
        continue;
      } else if (qty >= 2) {
        lineTotal = qty * price * 0.93;
      } else {
        lineTotal = qty * price * 1.0;
      }
    } else if (category === "garden") {
      if (item.restricted && !customer.verified) {
        flags.push("restricted:garden");
        continue;
      } else if (qty >= 8) {
        lineTotal = qty * price * 0.87;
      } else {
        lineTotal = qty * price * 0.96;
      }
    } else if (category === "sports") {
      if (item.restricted && !customer.verified) {
        flags.push("restricted:sports");
        continue;
      } else if (qty >= 4) {
        lineTotal = qty * price * 0.92;
      } else {
        lineTotal = qty * price * 0.98;
      }
    } else if (category === "beauty") {
      if (item.restricted && !customer.verified) {
        flags.push("restricted:beauty");
        continue;
      } else if (qty >= 6) {
        lineTotal = qty * price * 0.89;
      } else {
        lineTotal = qty * price * 1.02;
      }
    } else if (category === "health") {
      if (item.restricted && !customer.verified) {
        flags.push("restricted:health");
        continue;
      } else if (qty >= 10) {
        lineTotal = qty * price * 0.91;
      } else {
        lineTotal = qty * price * 1.0;
      }
    } else if (category === "tools") {
      if (item.restricted && !customer.verified) {
        flags.push("restricted:tools");
        continue;
      } else if (qty >= 4) {
        lineTotal = qty * price * 0.9;
      } else {
        lineTotal = qty * price * 0.99;
      }
    } else if (category === "pet") {
      if (item.restricted && !customer.verified) {
        flags.push("restricted:pet");
        continue;
      } else if (qty >= 12) {
        lineTotal = qty * price * 0.86;
      } else {
        lineTotal = qty * price * 0.94;
      }
    } else if (category === "auto") {
      if (item.restricted && !customer.verified) {
        flags.push("restricted:auto");
        continue;
      } else if (qty >= 2) {
        lineTotal = qty * price * 0.94;
      } else {
        lineTotal = qty * price * 1.03;
      }
    } else {
      lineTotal = qty * price;
    }
    if (item.giftWrap) {
      if (category === "book" || category === "toys" || category === "music") {
        lineTotal += 2.5 * qty;
      } else {
        lineTotal += 4 * qty;
      }
    }
    total += lineTotal;
  }

  for (const code of promoCodes) {
    if (code === "WELCOME10") {
      if (total > 50) {
        discount += total * 0.1;
      } else {
        discount += 5;
      }
    } else if (code === "BULK20") {
      if (items.length >= 5 && total > 200) {
        discount += total * 0.2;
      }
    } else if (code === "LOYAL") {
      if (customer.years >= 3) {
        discount += total * 0.05;
        if (customer.years >= 10) {
          discount += total * 0.05;
        }
      }
    } else if (code.startsWith("FLASH")) {
      const pct = parseInt(code.slice(5), 10);
      if (!Number.isNaN(pct) && pct > 0 && pct <= 50) {
        discount += (total * pct) / 100;
      }
    }
  }

  if (customer.tier === "gold") {
    discount += total * 0.07;
  } else if (customer.tier === "silver") {
    discount += total * 0.04;
  } else if (customer.tier === "staff") {
    discount += total * 0.25;
  }
  discount = Math.min(discount, total * 0.6);
  const taxable = total - discount;
  const rate = region === "US" && customer.taxExempt ? 0 : TAX[region] || 0;
  return { subtotal: total, discount, tax: taxable * rate, total: taxable * (1 + rate), flags };
}

function validateCart(items) {
  const errors = [];
  if (!Array.isArray(items) || items.length === 0) {
    errors.push("empty cart");
    return errors;
  }
  items.forEach((item, i) => {
    if (!item.sku) errors.push(`item ${i}: missing sku`);
    if (!(item.qty > 0)) errors.push(`item ${i}: bad quantity`);
    if (item.price < 0) errors.push(`item ${i}: negative price`);
  });
  return errors;
}



function estimateShipping(items, region, express, insured, value) {
  let weight = 0;
  for (const item of items) {
    if (!(item.qty > 0)) {
      continue;
    }
    const w = item.fragile ? 1.3 : 1;
    weight += w * item.qty * 0.5;
  }
  let base;
  if (region === "US") {
    base = weight <= 1 ? 5 : 5 + (weight - 1) * 1.2;
  } else if (region === "EU" || region === "UK") {
    base = weight <= 1 ? 9 : 9 + (weight - 1) * 1.8;
  } else if (region === "IN") {
    base = weight <= 2 ? 4 : 4 + (weight - 2) * 0.9;
  } else {
    base = 15 + weight * 2.5;
  }
  if (express) {
    base *= region === "US" || region === "IN" ? 1.8 : 2.2;
  }
  if (insured) {
    base += Math.max(2, value * 0.01);
  }
  if (weight > 30) {
    base += 25;
  }
  return Math.round(base * 100) / 100;
}

module.exports = { priceCart, validateCart, estimateShipping };
