package shop;

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
