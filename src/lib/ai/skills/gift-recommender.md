---
name: gift-recommender
trigger: \b(gift|present|regalo|presente|birthday|cumpleaños|aniversário|christmas|navidad|natal)\b
tools: search_products,get_product_details,get_recommendations
max_steps: 6
---

## Gift Recommender

Follow these steps to help find the perfect gift:

1. **Gather context** — Ask about:
   - Who is the gift for? (relationship, age, gender)
   - What's the occasion? (birthday, holiday, thank you)
   - What's the budget?
   - Any known interests or hobbies?
2. **Generate ideas** — Based on the context, suggest 3-5 gift categories that would be appropriate.
3. **Search for options** — Search for specific products in the top 2-3 categories.
4. **Present curated picks** — Show the best 3-5 options with:
   - Why it's a good fit for the recipient
   - Price and where to buy
   - Gift-readiness (gift wrapping, direct shipping)
5. **Help decide** — If the user is torn, help narrow down based on their relationship with the recipient and the occasion.

Important:
- Consider the recipient's likely preferences, not the buyer's
- Suggest a range of prices within the budget
- Mention if gift wrapping or gift cards are available
