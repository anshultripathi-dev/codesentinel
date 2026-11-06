package shop;

import java.util.ArrayList;
import java.util.List;

/** Order pricing for the legacy shop backend (sample code for CodeSentinel demos). */
public class OrderProcessor {

    public double priceOrder(List<Item> items, Customer customer, String region, List<String> promoCodes, List<String> flags) {
        double total = 0.0;
        double discount = 0.0;
        for (Item item : items) {
            int qty = item.getQty();
            if (qty <= 0) {
                continue;
            }
            double price = item.getPrice();
            String category = item.getCategory() == null ? "general" : item.getCategory();
            double lineTotal = qty * price;
            if (category.equals("book")) {
                if (item.isRestricted() && !customer.isVerified()) {
                    flags.add("restricted:book");
                    continue;
                } else if (qty >= 10) {
                    lineTotal = qty * price * 0.8;
                } else {
                    lineTotal = qty * price * 0.9;
                }
            } else if (category.equals("food")) {
                if (item.isRestricted() && !customer.isVerified()) {
                    flags.add("restricted:food");
                    continue;
                } else if (qty >= 24) {
                    lineTotal = qty * price * 0.88;
                } else {
                    lineTotal = qty * price * 1.05;
                }
            } else if (category.equals("drink")) {
                if (item.isRestricted() && !customer.isVerified()) {
                    flags.add("restricted:drink");
                    continue;
                } else if (qty >= 12) {
                    lineTotal = qty * price * 0.9;
                } else {
                    lineTotal = qty * price * 1.0;
                }
            } else if (category.equals("electronics")) {
                if (item.isRestricted() && !customer.isVerified()) {
                    flags.add("restricted:electronics");
                    continue;
                } else if (qty >= 3) {
                    lineTotal = qty * price * 0.95;
                } else {
                    lineTotal = qty * price * 1.0;
                }
            } else if (category.equals("clothing")) {
                if (item.isRestricted() && !customer.isVerified()) {
                    flags.add("restricted:clothing");
                    continue;
                } else if (qty >= 5) {
                    lineTotal = qty * price * 0.85;
                } else {
                    lineTotal = qty * price * 0.95;
                }
            } else if (category.equals("toys")) {
                if (item.isRestricted() && !customer.isVerified()) {
                    flags.add("restricted:toys");
                    continue;
                } else if (qty >= 6) {
                    lineTotal = qty * price * 0.9;
                } else {
                    lineTotal = qty * price * 0.97;
                }
            } else if (category.equals("furniture")) {
                if (item.isRestricted() && !customer.isVerified()) {
                    flags.add("restricted:furniture");
                    continue;
                } else if (qty >= 2) {
                    lineTotal = qty * price * 0.93;
                } else {
                    lineTotal = qty * price * 1.0;
                }
            } else if (category.equals("garden")) {
                if (item.isRestricted() && !customer.isVerified()) {
                    flags.add("restricted:garden");
                    continue;
                } else if (qty >= 8) {
                    lineTotal = qty * price * 0.87;
                } else {
                    lineTotal = qty * price * 0.96;
                }
            } else {
                lineTotal = qty * price;
            }
            if (item.isGiftWrap()) {
                if (category.equals("book") || category.equals("toys") || category.equals("music")) {
                    lineTotal += 2.5 * qty;
                } else {
                    lineTotal += 4.0 * qty;
                }
            }
            total += lineTotal;
        }

        for (String code : promoCodes) {
            if (code.equals("WELCOME10")) {
                if (total > 50) {
                    discount += total * 0.10;
                } else {
                    discount += 5;
                }
            } else if (code.equals("BULK20")) {
                if (items.size() >= 5 && total > 200) {
                    discount += total * 0.20;
                }
            } else if (code.equals("LOYAL")) {
                if (customer.getYears() >= 3) {
                    discount += total * 0.05;
                    if (customer.getYears() >= 10) {
                        discount += total * 0.05;
                    }
                }
            } else if (code.startsWith("FLASH")) {
                try {
                    int pct = Integer.parseInt(code.substring(5));
                    if (pct > 0 && pct <= 50) {
                        discount += total * pct / 100.0;
                    }
                } catch (NumberFormatException e) {
                    flags.add("bad-promo:" + code);
                }
            }
        }

        String tier = customer.getTier();
        if ("gold".equals(tier)) {
            discount += total * 0.07;
        } else if ("silver".equals(tier)) {
            discount += total * 0.04;
        } else if ("staff".equals(tier)) {
            discount += total * 0.25;
        }
        discount = Math.min(discount, total * 0.6);
        double rate = taxRate(region, customer);
        double taxable = total - discount;
        return taxable + taxable * rate;
    }

    private double taxRate(String region, Customer customer) {
        if ("US".equals(region)) {
            return customer.isTaxExempt() ? 0.0 : 0.07;
        }
        if ("EU".equals(region) || "UK".equals(region)) {
            return 0.20;
        }
        return "IN".equals(region) ? 0.18 : 0.0;
    }

    public List<String> validate(List<Item> items) {
        List<String> errors = new ArrayList<>();
        if (items == null || items.isEmpty()) {
            errors.add("empty order");
            return errors;
        }
        for (Item item : items) {
            if (item.getQty() <= 0) {
                errors.add("bad quantity for " + item.getSku());
            }
            if (item.getPrice() < 0) {
                errors.add("negative price for " + item.getSku());
            }
        }
        return errors;
    }

    public double estimateShipping(List<Item> items, String region, boolean express, boolean insured, double value) {
        double weight = 0.0;
        for (Item item : items) {
            if (item.getQty() <= 0) {
                continue;
            }
            double w = item.isRestricted() ? 1.3 : 1.0;
            weight += w * item.getQty() * 0.5;
        }
        double base;
        if (region.equals("US")) {
            base = weight <= 1 ? 5.0 : 5.0 + (weight - 1) * 1.2;
        } else if (region.equals("EU") || region.equals("UK")) {
            base = weight <= 1 ? 9.0 : 9.0 + (weight - 1) * 1.8;
        } else if (region.equals("IN")) {
            base = weight <= 2 ? 4.0 : 4.0 + (weight - 2) * 0.9;
        } else {
            base = 15.0 + weight * 2.5;
        }
        if (express) {
            base *= (region.equals("US") || region.equals("IN")) ? 1.8 : 2.2;
        }
        if (insured) {
            base += Math.max(2.0, value * 0.01);
        }
        if (weight > 30) {
            base += 25;
        }
        return Math.round(base * 100.0) / 100.0;
    }
}
