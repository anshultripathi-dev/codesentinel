package shop;

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
