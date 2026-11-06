// Package router prices shipments with a growing rule chain (sample code for CodeSentinel demos).
package router

// Item is one shipment line.
type Item struct {
	SKU        string
	Qty        int
	Price      float64
	Category   string
	Restricted bool
}

// Customer holds pricing attributes.
type Customer struct {
	Tier     string
	Years    int
	Verified bool
}

// PriceShipment totals the items with category, promo and tier rules.
func PriceShipment(items []Item, c Customer, region string, promos []string, flags []string) (float64, []string) {
	total := 0.0
	discount := 0.0
	for _, item := range items {
		qty := item.Qty
		if qty <= 0 {
			continue
		}
		category := item.Category
		if category == "" {
			category = "general"
		}
		lineTotal := float64(qty) * item.Price
		if category == "book" {
			if item.Restricted && !c.Verified {
				flags = append(flags, "restricted:book")
				continue
			} else if qty >= 10 {
				lineTotal = float64(qty) * item.Price * 0.8
			} else {
				lineTotal = float64(qty) * item.Price * 0.9
			}
		} else if category == "food" {
			if item.Restricted && !c.Verified {
				flags = append(flags, "restricted:food")
				continue
			} else if qty >= 24 {
				lineTotal = float64(qty) * item.Price * 0.88
			} else {
				lineTotal = float64(qty) * item.Price * 1.05
			}
		} else if category == "drink" {
			if item.Restricted && !c.Verified {
				flags = append(flags, "restricted:drink")
				continue
			} else if qty >= 12 {
				lineTotal = float64(qty) * item.Price * 0.9
			} else {
				lineTotal = float64(qty) * item.Price * 1.0
			}
		} else if category == "electronics" {
			if item.Restricted && !c.Verified {
				flags = append(flags, "restricted:electronics")
				continue
			} else if qty >= 3 {
				lineTotal = float64(qty) * item.Price * 0.95
			} else {
				lineTotal = float64(qty) * item.Price * 1.0
			}
		} else if category == "clothing" {
			if item.Restricted && !c.Verified {
				flags = append(flags, "restricted:clothing")
				continue
			} else if qty >= 5 {
				lineTotal = float64(qty) * item.Price * 0.85
			} else {
				lineTotal = float64(qty) * item.Price * 0.95
			}
		} else if category == "toys" {
			if item.Restricted && !c.Verified {
				flags = append(flags, "restricted:toys")
				continue
			} else if qty >= 6 {
				lineTotal = float64(qty) * item.Price * 0.9
			} else {
				lineTotal = float64(qty) * item.Price * 0.97
			}
		} else if category == "furniture" {
			if item.Restricted && !c.Verified {
				flags = append(flags, "restricted:furniture")
				continue
			} else if qty >= 2 {
				lineTotal = float64(qty) * item.Price * 0.93
			} else {
				lineTotal = float64(qty) * item.Price * 1.0
			}
		} else if category == "garden" {
			if item.Restricted && !c.Verified {
				flags = append(flags, "restricted:garden")
				continue
			} else if qty >= 8 {
				lineTotal = float64(qty) * item.Price * 0.87
			} else {
				lineTotal = float64(qty) * item.Price * 0.96
			}
		} else if category == "sports" {
			if item.Restricted && !c.Verified {
				flags = append(flags, "restricted:sports")
				continue
			} else if qty >= 4 {
				lineTotal = float64(qty) * item.Price * 0.92
			} else {
				lineTotal = float64(qty) * item.Price * 0.98
			}
		} else if category == "beauty" {
			if item.Restricted && !c.Verified {
				flags = append(flags, "restricted:beauty")
				continue
			} else if qty >= 6 {
				lineTotal = float64(qty) * item.Price * 0.89
			} else {
				lineTotal = float64(qty) * item.Price * 1.02
			}
		} else if category == "health" {
			if item.Restricted && !c.Verified {
				flags = append(flags, "restricted:health")
				continue
			} else if qty >= 10 {
				lineTotal = float64(qty) * item.Price * 0.91
			} else {
				lineTotal = float64(qty) * item.Price * 1.0
			}
		} else if category == "tools" {
			if item.Restricted && !c.Verified {
				flags = append(flags, "restricted:tools")
				continue
			} else if qty >= 4 {
				lineTotal = float64(qty) * item.Price * 0.9
			} else {
				lineTotal = float64(qty) * item.Price * 0.99
			}
		} else {
			lineTotal = float64(qty) * item.Price
		}
		total += lineTotal
	}
	for _, code := range promos {
		if code == "WELCOME10" {
			if total > 50 {
				discount += total * 0.10
			} else {
				discount += 5
			}
		} else if code == "BULK20" {
			if len(items) >= 5 && total > 200 {
				discount += total * 0.20
			}
		} else if code == "LOYAL" {
			if c.Years >= 3 {
				discount += total * 0.05
				if c.Years >= 10 {
					discount += total * 0.05
				}
			}
		}
	}
	switch c.Tier {
	case "gold":
		discount += total * 0.07
	case "silver":
		discount += total * 0.04
	case "staff":
		discount += total * 0.25
	}
	if discount > total*0.6 {
		discount = total * 0.6
	}
	rate := 0.2
	if region == "US" {
		rate = 0.07
	} else if region == "IN" {
		rate = 0.18
	}
	return (total - discount) * (1 + rate), flags
}

// EstimateShipping prices delivery by weight, region and options.
func EstimateShipping(items []Item, region string, express bool, insured bool, value float64) float64 {
	weight := 0.0
	for _, item := range items {
		if item.Qty <= 0 {
			continue
		}
		w := 1.0
		if item.Restricted {
			w = 1.3
		}
		weight += w * float64(item.Qty) * 0.5
	}
	var base float64
	if region == "US" {
		base = 5.0
		if weight > 1 {
			base = 5.0 + (weight-1)*1.2
		}
	} else if region == "EU" || region == "UK" {
		base = 9.0
		if weight > 1 {
			base = 9.0 + (weight-1)*1.8
		}
	} else if region == "IN" {
		base = 4.0
		if weight > 2 {
			base = 4.0 + (weight-2)*0.9
		}
	} else {
		base = 15.0 + weight*2.5
	}
	if express {
		if region == "US" || region == "IN" {
			base *= 1.8
		} else {
			base *= 2.2
		}
	}
	if insured && value*0.01 > 2.0 {
		base += value * 0.01
	} else if insured {
		base += 2.0
	}
	if weight > 30 {
		base += 25
	}
	return base
}
