package shop;

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
