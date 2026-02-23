import { tool } from "ai";
import { z } from "zod";
import { runAutomation } from "@/lib/tinyfish/client";

const shippingSchema = z.object({
  fullName: z.string().describe("Recipient's full name"),
  email: z.string().email().describe("Contact email for order updates"),
  phone: z.string().optional().describe("Phone number (some retailers require it)"),
  address1: z.string().describe("Street address line 1"),
  address2: z.string().optional().describe("Apartment, suite, unit, etc."),
  city: z.string().describe("City"),
  state: z.string().describe("State/province/region"),
  zip: z.string().describe("ZIP or postal code"),
  country: z.string().default("US").describe("Country code (e.g. US, AR, BR)"),
});

export const purchase = tool({
  description:
    "Navigate to a retailer's product page, add the item to cart, fill in shipping details, and stop at the payment page. Returns a live browser URL so the user can enter payment details themselves. CRITICAL: Collect ALL shipping info from the user BEFORE calling this tool. NEVER fill in or transmit payment card details.",
  inputSchema: z.object({
    retailerUrl: z
      .string()
      .url()
      .describe(
        "Direct URL to the product on the retailer's site (NOT a Google Shopping link)"
      ),
    productName: z
      .string()
      .describe("Name of the product (for display and goal context)"),
    quantity: z
      .number()
      .optional()
      .default(1)
      .describe("Number of items to add"),
    shipping: shippingSchema.describe("Shipping address and contact info"),
  }),
  execute: async ({ retailerUrl, productName, quantity, shipping }) => {
    const goal = buildPurchaseGoal(productName, quantity, shipping);

    try {
      const result = await runAutomation({
        url: retailerUrl,
        goal,
        browser_profile: "stealth",
      });

      if (!result.success) {
        return {
          success: false,
          waitingForPayment: false,
          productName,
          retailerUrl,
          error: result.error ?? "Purchase automation failed",
          statusMessages: result.statusMessages,
          streamingUrl: result.streamingUrl,
        };
      }

      return {
        success: true,
        waitingForPayment: true,
        productName,
        retailerUrl,
        quantity,
        streamingUrl: result.streamingUrl,
        orderSummary: result.data,
        statusMessages: result.statusMessages,
      };
    } catch (error) {
      return {
        success: false,
        waitingForPayment: false,
        productName,
        retailerUrl,
        error: error instanceof Error ? error.message : "Unknown error",
        statusMessages: [],
      };
    }
  },
});

function buildPurchaseGoal(
  productName: string,
  quantity: number,
  shipping: z.infer<typeof shippingSchema>
): string {
  return `You are a shopping assistant. Complete the following steps IN ORDER:

1. FIND the product "${productName}" on this page. If it's already the product page, proceed. If not, search for it.
2. ADD ${quantity} item(s) to the shopping cart. If there are size/color options, select the first available option.
3. GO TO the shopping cart and proceed to checkout.
4. FILL IN the shipping information:
   - Full name: ${shipping.fullName}
   - Email: ${shipping.email}
   ${shipping.phone ? `- Phone: ${shipping.phone}` : ""}
   - Address: ${shipping.address1}
   ${shipping.address2 ? `- Address line 2: ${shipping.address2}` : ""}
   - City: ${shipping.city}
   - State: ${shipping.state}
   - ZIP: ${shipping.zip}
   - Country: ${shipping.country}
5. SELECT any available shipping method (cheapest option preferred).
6. PROCEED to the payment page.
7. STOP — Do NOT enter any payment/credit card information. Do NOT submit the order.

After reaching the payment page, extract the order summary as JSON:
{
  "items": [{ "name": "...", "price": "...", "quantity": ... }],
  "subtotal": "...",
  "shipping": "...",
  "tax": "...",
  "total": "...",
  "currency": "...",
  "estimatedDelivery": "..."
}`;
}
