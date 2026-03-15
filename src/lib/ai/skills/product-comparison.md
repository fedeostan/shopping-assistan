---
name: product-comparison
trigger: \b(compare|versus|vs\.?|which\s*(is\s*)?better|diferencia|comparar|qual\s*melhor)\b
tools: search_products,get_product_details
max_steps: 6
---

## Product Comparison

Follow these steps to compare products:

1. **Identify the products** — Extract the products being compared from the user's message. If only one is mentioned, ask for the second.
2. **Search for both** — Use search_products for each product to find the best matches.
3. **Get details** — Fetch detailed specs for each product using get_product_details.
4. **Build comparison** — Present a structured comparison covering:
   - Price (across retailers)
   - Key specifications
   - Pros and cons of each
   - User ratings if available
5. **Make a recommendation** — Based on the user's persona (budget, preferences), suggest which product is the better fit and explain why.

Important:
- Compare at least 2-3 key differentiating specs
- Always include price from multiple retailers
- Consider the user's stated priorities when recommending
