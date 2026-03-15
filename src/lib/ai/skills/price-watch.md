---
name: price-watch
trigger: \b(track\s*price|price\s*alert|monitor\s*price|notify.*price|avisar\s*precio|acompanhar\s*pre[cç]o|alert.*drop)\b
tools: search_products,get_product_details,track_price
max_steps: 5
---

## Price Watch

Follow these steps to set up price monitoring:

1. **Identify the product** — If the user hasn't provided a specific product URL, search for it and confirm which product to track.
2. **Get current price** — Fetch the latest product details to establish the current price baseline.
3. **Set target price** — Ask the user what price they'd like to be notified at. Suggest a reasonable target (e.g., 10-20% below current price).
4. **Create the alert** — Use the track_price tool to set up the price alert.
5. **Confirm** — Let the user know the alert is active and they'll be notified when the price drops.

Important:
- Show the current price before asking for a target
- Suggest a realistic target price based on historical patterns if available
- Let the user know alerts are checked every 6 hours
