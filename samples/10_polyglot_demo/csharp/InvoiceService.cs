using System;
using System.Collections.Generic;

namespace Billing.Services
{
    /// <summary>Invoice totals for the legacy billing service (sample code for CodeSentinel demos).</summary>
    public class InvoiceService
    {
        public decimal Calculate(IList<LineItem> items, Customer customer, string region, IList<string> promoCodes, IList<string> flags)
        {
            decimal total = 0m;
            decimal discount = 0m;
            foreach (var item in items)
            {
                int qty = item.Qty;
                if (qty <= 0)
                {
                    continue;
                }
                string category = item.Category ?? "general";
                decimal lineTotal = qty * item.Price;
                if (category == "book")
                {
                    if (item.Restricted && !customer.Verified)
                    {
                        flags.Add("restricted:book");
                        continue;
                    }
                    else if (qty >= 10)
                    {
                        lineTotal = qty * item.Price * 0.8m;
                    }
                    else
                    {
                        lineTotal = qty * item.Price * 0.9m;
                    }
                }
                else if (category == "food")
                {
                    if (item.Restricted && !customer.Verified)
                    {
                        flags.Add("restricted:food");
                        continue;
                    }
                    else if (qty >= 24)
                    {
                        lineTotal = qty * item.Price * 0.88m;
                    }
                    else
                    {
                        lineTotal = qty * item.Price * 1.05m;
                    }
                }
                else if (category == "drink")
                {
                    if (item.Restricted && !customer.Verified)
                    {
                        flags.Add("restricted:drink");
                        continue;
                    }
                    else if (qty >= 12)
                    {
                        lineTotal = qty * item.Price * 0.9m;
                    }
                    else
                    {
                        lineTotal = qty * item.Price * 1.0m;
                    }
                }
                else if (category == "electronics")
                {
                    if (item.Restricted && !customer.Verified)
                    {
                        flags.Add("restricted:electronics");
                        continue;
                    }
                    else if (qty >= 3)
                    {
                        lineTotal = qty * item.Price * 0.95m;
                    }
                    else
                    {
                        lineTotal = qty * item.Price * 1.0m;
                    }
                }
                else if (category == "clothing")
                {
                    if (item.Restricted && !customer.Verified)
                    {
                        flags.Add("restricted:clothing");
                        continue;
                    }
                    else if (qty >= 5)
                    {
                        lineTotal = qty * item.Price * 0.85m;
                    }
                    else
                    {
                        lineTotal = qty * item.Price * 0.95m;
                    }
                }
                else if (category == "toys")
                {
                    if (item.Restricted && !customer.Verified)
                    {
                        flags.Add("restricted:toys");
                        continue;
                    }
                    else if (qty >= 6)
                    {
                        lineTotal = qty * item.Price * 0.9m;
                    }
                    else
                    {
                        lineTotal = qty * item.Price * 0.97m;
                    }
                }
                else
                {
                    lineTotal = qty * item.Price;
                }
                if (item.GiftWrap)
                {
                    if (category == "book" || category == "toys" || category == "music")
                    {
                        lineTotal += 2.5m * qty;
                    }
                    else
                    {
                        lineTotal += 4m * qty;
                    }
                }
                total += lineTotal;
            }

            foreach (var code in promoCodes)
            {
                if (code == "WELCOME10")
                {
                    discount += total > 50 ? total * 0.10m : 5m;
                }
                else if (code == "BULK20")
                {
                    if (items.Count >= 5 && total > 200)
                    {
                        discount += total * 0.20m;
                    }
                }
                else if (code == "LOYAL")
                {
                    if (customer.Years >= 3)
                    {
                        discount += total * 0.05m;
                        if (customer.Years >= 10)
                        {
                            discount += total * 0.05m;
                        }
                    }
                }
                else if (code.StartsWith("FLASH"))
                {
                    int pct;
                    if (int.TryParse(code.Substring(5), out pct) && pct > 0 && pct <= 50)
                    {
                        discount += total * pct / 100m;
                    }
                }
            }

            switch (customer.Tier)
            {
                case "gold": discount += total * 0.07m; break;
                case "silver": discount += total * 0.04m; break;
                case "staff": discount += total * 0.25m; break;
            }
            discount = Math.Min(discount, total * 0.6m);
            decimal rate = region == "US" ? 0.07m : region == "IN" ? 0.18m : 0.20m;
            return (total - discount) * (1 + rate);
        }

        public decimal EstimateShipping(IList<LineItem> items, string region, bool express, bool insured, decimal value)
        {
            decimal weight = 0m;
            foreach (var item in items)
            {
                if (item.Qty <= 0)
                {
                    continue;
                }
                decimal w = item.Restricted ? 1.3m : 1m;
                weight += w * item.Qty * 0.5m;
            }
            decimal baseCost;
            if (region == "US")
            {
                baseCost = weight <= 1 ? 5m : 5m + (weight - 1) * 1.2m;
            }
            else if (region == "EU" || region == "UK")
            {
                baseCost = weight <= 1 ? 9m : 9m + (weight - 1) * 1.8m;
            }
            else if (region == "IN")
            {
                baseCost = weight <= 2 ? 4m : 4m + (weight - 2) * 0.9m;
            }
            else
            {
                baseCost = 15m + weight * 2.5m;
            }
            if (express)
            {
                baseCost *= (region == "US" || region == "IN") ? 1.8m : 2.2m;
            }
            if (insured)
            {
                baseCost += Math.Max(2m, value * 0.01m);
            }
            if (weight > 30)
            {
                baseCost += 25m;
            }
            return Math.Round(baseCost, 2);
        }
    }

    public class LineItem
    {
        public int Qty { get; set; }
        public decimal Price { get; set; }
        public string Category { get; set; }
        public bool Restricted { get; set; }
        public bool GiftWrap { get; set; }
    }

    public class Customer
    {
        public string Tier { get; set; }
        public int Years { get; set; }
        public bool Verified { get; set; }
    }
}
