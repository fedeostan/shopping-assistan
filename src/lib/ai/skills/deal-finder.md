---
name: deal-finder
trigger: \b(deal|cheapest|best\s*price|lowest\s*price|oferta|barato|descuento|promoção|mais\s*barato|sale|discount|coupon)\b
tools: search_products,get_product_details
max_steps: 5
---

## Deal Finder

Follow these steps to find the best deals:

1. **Clarify what they're looking for** — If the user hasn't specified a product category, ask what kind of deal they want.
2. **Search broadly** — Search across multiple terms and sort by price to find the lowest options.
3. **Verify deals** — Get product details to confirm:
   - The price is actually a good deal (not inflated then "discounted")
   - The product is from a reputable seller
   - Shipping costs don't negate the savings
4. **Present the best finds** — Show top 3-5 deals with:
   - Current price vs. typical/original price
   - Savings amount and percentage
   - Retailer and shipping details
5. **Offer to track** — If the price isn't low enough, offer to set up a price alert for further drops.

Important:
- Always verify the "deal" is real — compare across retailers
- Factor in shipping costs when comparing prices
- Warn about suspiciously low prices from unknown sellers
