// Pricing engine (sample code for CodeSentinel demos).
export interface Item {
  sku: string;
  qty: number;
  price: number;
  category?: string;
  restricted?: boolean;
}

export interface Customer {
  tier: "standard" | "silver" | "gold" | "staff";
  years: number;
  verified: boolean;
}

export function priceItems(
  items: Item[],
  customer: Customer,
  region: string,
  promoCodes: string[],
  flags: string[],
): number {
  let total = 0;
  let discount = 0;
  for (const item of items) {
    const qty = item.qty;
    if (qty <= 0) {
      continue;
    }
    const price = item.price;
    const category = item.category ?? "general";
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
    } else {
      lineTotal = qty * price;
    }
    total += lineTotal;
  }
  for (const code of promoCodes) {
    if (code === "WELCOME10") {
      discount += total > 50 ? total * 0.1 : 5;
    } else if (code === "BULK20") {
      if (items.length >= 5 && total > 200) {
        discount += total * 0.2;
      }
    } else if (code === "LOYAL" && customer.years >= 3) {
      discount += total * (customer.years >= 10 ? 0.1 : 0.05);
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
  const rate = region === "US" ? 0.07 : region === "IN" ? 0.18 : 0.2;
  return (total - discount) * (1 + rate);
}

export function estimateShipping(items: Item[], region: string, express: boolean, insured: boolean, value: number): number {
  let weight = 0;
  for (const item of items) {
    if (item.qty <= 0) {
      continue;
    }
    const w = item.restricted ? 1.3 : 1;
    weight += w * item.qty * 0.5;
  }
  let base: number;
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
