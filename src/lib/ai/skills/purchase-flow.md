---
name: purchase-flow
trigger: \b(buy|purchase|order|checkout|comprar|adquirir)\b
tools: search_products,get_product_details,purchase
max_steps: 8
---

## Purchase Flow

Follow these steps to help the user complete a purchase:

1. **Confirm the product** — If the user hasn't specified an exact product, search for it and present the top options. Ask which one they want to buy.
2. **Get full details** — Fetch product details (price, availability, shipping) for the selected product.
3. **Verify the price** — Confirm the current price with the user before proceeding.
4. **Check payment method** — Ensure the user has a saved payment method. If not, direct them to add one in Settings.
5. **Confirm shipping** — Verify the user's shipping address is correct.
6. **Execute purchase** — Use the purchase tool to complete the order.
7. **Confirm completion** — Show order confirmation with estimated delivery date.

Important:
- ALWAYS confirm the exact product and price before purchasing
- NEVER proceed without explicit user confirmation at step 6
- If the product is out of stock, suggest alternatives
