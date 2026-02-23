import { tool } from "ai";
import { z } from "zod";
import { createServiceClient } from "@/lib/db/supabase";

export function createTrackPrice(userId: string | null) {
  return tool({
    description:
      "Set up a price alert for a product. Notifies the user when the price drops to their target. Use this when the user wants to monitor a product's price or wait for a deal.",
    inputSchema: z.object({
      productName: z.string().describe("The product to track"),
      productUrl: z
        .string()
        .url()
        .optional()
        .describe("Direct URL to the product if available"),
      targetPrice: z
        .number()
        .optional()
        .describe("The target price to notify at. If not provided, notify on any price drop."),
      currentPrice: z
        .number()
        .optional()
        .describe("The current known price of the product"),
      currency: z
        .string()
        .optional()
        .default("USD")
        .describe("Currency for the prices"),
    }),
    execute: async ({ productName, productUrl, targetPrice, currentPrice, currency }) => {
      if (!userId) {
        return {
          status: "error",
          message: "You must be logged in to track prices. Please sign in first.",
        };
      }

      const supabase = createServiceClient();

      const { data, error } = await supabase
        .from("price_alerts")
        .insert({
          user_id: userId,
          product_url: productUrl ?? null,
          target_price: targetPrice ?? null,
          current_price: currentPrice ?? null,
          currency,
        })
        .select("id")
        .single();

      if (error) {
        return {
          status: "error",
          message: `Failed to create price alert: ${error.message}`,
        };
      }

      return {
        status: "tracking",
        alertId: data.id,
        productName,
        targetPrice: targetPrice ?? null,
        currentPrice: currentPrice ?? null,
        currency,
        message: targetPrice
          ? `Price alert set! I'll check when ${productName} drops to ${currency} ${targetPrice} or below.`
          : `Now tracking ${productName}. I'll check for any price changes.`,
      };
    },
  });
}
