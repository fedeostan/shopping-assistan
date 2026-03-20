import { tool } from "ai";
import { z } from "zod";
import { logInteraction } from "@/lib/persona/engine";

const productSchema = z.object({
  title: z.string(),
  brand: z.string().optional(),
  imageUrl: z.string().optional(),
  productUrl: z.string().optional(),
  retailerUrl: z.string().optional(),
  currentPrice: z.number(),
  originalPrice: z.number().optional(),
  currency: z.string(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  source: z.string(),
  availability: z.string().optional(),
  specs: z.record(z.string(), z.string()).optional(),
});

export function createCompareProducts(userId: string | null) {
  return tool({
    description:
      "Compare 2-6 products side-by-side. Pass product data already gathered from search_products or get_product_details. Returns structured comparison with highlights and badges for visual rendering.",
    inputSchema: z.object({
      products: z
        .array(productSchema)
        .min(2)
        .max(6)
        .describe("Products to compare (2-6)"),
      focus: z
        .string()
        .optional()
        .describe(
          "Optional dimension to prioritize, e.g. 'battery life' or 'price'"
        ),
    }),
    execute: async ({ products, focus }) => {
      console.log(
        `[Tool:compare] START products=${products.length} focus=${focus ?? "none"}`
      );

      // Collect dimensions: Price, Rating, Reviews first, then spec keys by frequency
      const specFrequency = new Map<string, number>();
      for (const p of products) {
        if (p.specs) {
          for (const key of Object.keys(p.specs)) {
            specFrequency.set(key, (specFrequency.get(key) ?? 0) + 1);
          }
        }
      }

      const coreDimensions = ["Price", "Rating", "Reviews"];
      const specDimensions = [...specFrequency.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([key]) => key);

      const baseDimensions = [...coreDimensions, ...specDimensions];

      // If focus provided, move matching dimension to top
      const dimensions = (() => {
        if (!focus) return baseDimensions;
        const focusLower = focus.toLowerCase();
        const idx = baseDimensions.findIndex(
          (d) => d.toLowerCase().includes(focusLower) || focusLower.includes(d.toLowerCase())
        );
        if (idx <= 0) return baseDimensions;
        const reordered = [...baseDimensions];
        const [moved] = reordered.splice(idx, 1);
        reordered.unshift(moved);
        return reordered;
      })();

      // Compute winners for each dimension
      const winners: Record<string, number> = {};

      // Price: lowest wins
      const priceWinner = products.reduce(
        (best, p, i) => (p.currentPrice < products[best].currentPrice ? i : best),
        0
      );
      winners["Price"] = priceWinner;

      // Rating: highest wins
      const rated = products
        .map((p, i) => ({ rating: p.rating ?? 0, i }))
        .filter((x) => x.rating > 0);
      if (rated.length > 0) {
        winners["Rating"] = rated.reduce((best, x) =>
          x.rating > best.rating ? x : best
        ).i;
      }

      // Reviews: highest count wins
      const reviewed = products
        .map((p, i) => ({ count: p.reviewCount ?? 0, i }))
        .filter((x) => x.count > 0);
      if (reviewed.length > 0) {
        winners["Reviews"] = reviewed.reduce((best, x) =>
          x.count > best.count ? x : best
        ).i;
      }

      // Spec dimensions: try numeric comparison, fallback to skip
      for (const dim of specDimensions) {
        const values = products.map((p, i) => ({
          val: p.specs?.[dim],
          i,
        }));
        const numeric = values
          .filter((v) => v.val !== undefined)
          .map((v) => ({ num: parseFloat(v.val!.replace(/[^0-9.]/g, "")), i: v.i }))
          .filter((v) => !isNaN(v.num));

        if (numeric.length >= 2) {
          // Higher is generally better for specs (RAM, storage, battery, etc.)
          // Exception: weight, price-like dimensions where lower is better
          const lowerIsBetter = /weight|thickness|price/i.test(dim);
          winners[dim] = numeric.reduce((best, x) =>
            lowerIsBetter
              ? x.num < best.num ? x : best
              : x.num > best.num ? x : best
          ).i;
        }
      }

      // Compute badges
      const badges: Array<{
        productIndex: number;
        label: "Best Value" | "Top Rated" | "Best Overall";
        variant: "green" | "blue" | "amber";
      }> = [];

      // Best Value: lowest price among products with rating >= average
      const avgRating =
        products.reduce((s, p) => s + (p.rating ?? 0), 0) /
        products.filter((p) => p.rating != null).length || 0;
      const valueCandidates = products
        .map((p, i) => ({ price: p.currentPrice, rating: p.rating ?? 0, i }))
        .filter((x) => x.rating >= avgRating);
      if (valueCandidates.length > 0) {
        const bestValue = valueCandidates.reduce((best, x) =>
          x.price < best.price ? x : best
        );
        badges.push({
          productIndex: bestValue.i,
          label: "Best Value",
          variant: "green",
        });
      }

      // Top Rated: highest rating
      if (rated.length > 0) {
        const topRated = rated.reduce((best, x) =>
          x.rating > best.rating ? x : best
        );
        badges.push({
          productIndex: topRated.i,
          label: "Top Rated",
          variant: "blue",
        });
      }

      // Best Overall: composite of normalized price + rating
      const prices = products.map((p) => p.currentPrice);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const priceRange = maxPrice - minPrice || 1;

      const ratings = products.map((p) => p.rating ?? 0);
      const minRating = Math.min(...ratings);
      const maxRating = Math.max(...ratings);
      const ratingRange = maxRating - minRating || 1;

      const composites = products.map((p, i) => {
        const priceScore = 1 - (p.currentPrice - minPrice) / priceRange; // lower price = higher score
        const ratingScore = ((p.rating ?? 0) - minRating) / ratingRange;
        return { score: priceScore * 0.5 + ratingScore * 0.5, i };
      });
      const bestOverall = composites.reduce((best, x) =>
        x.score > best.score ? x : best
      );
      // Only add if not already the same product as another badge
      const existingBadgeIndices = new Set(badges.map((b) => b.productIndex));
      if (!existingBadgeIndices.has(bestOverall.i)) {
        badges.push({
          productIndex: bestOverall.i,
          label: "Best Overall",
          variant: "amber",
        });
      }

      // Log persona interaction
      if (userId) {
        logInteraction({
          userId,
          type: "compare",
          payload: {
            productCount: products.length,
            titles: products.map((p) => p.title),
            focus,
          },
          personaSignals: [],
        }).catch(console.error);
      }

      console.log(
        `[Tool:compare] DONE products=${products.length} dimensions=${dimensions.length} badges=${badges.length}`
      );

      return {
        products,
        dimensions,
        winners,
        badges,
        focus,
      };
    },
  });
}
