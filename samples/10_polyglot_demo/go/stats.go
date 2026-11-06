// Package mathx has small numeric helpers (sample code for CodeSentinel demos).
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
