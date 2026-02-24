import { tool } from "ai";
import { z } from "zod";
import { runAutomation } from "@/lib/tinyfish/client";
import { createServiceClient } from "@/lib/db/supabase";
import { decryptCardData } from "@/lib/crypto/card-encryption";

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

interface PaymentData {
  cardNumber: string;
  cvv: string;
  cardholderName: string;
  expMonth: number;
  expYear: number;
}

export function createPurchase(userId: string | null) {
  return tool({
    description:
      "Navigate to a retailer's product page, add the item to cart, fill in shipping details, and proceed to payment. If the user has a saved default card and usePaymentMethod is true, auto-fills payment details. Otherwise stops at the payment page and returns a live browser URL.",
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
      usePaymentMethod: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to auto-fill saved payment method"),
    }),
    execute: async ({ retailerUrl, productName, quantity, shipping, usePaymentMethod }) => {
      // Try to fetch saved payment method
      let paymentData: PaymentData | null = null;
      if (userId && usePaymentMethod) {
        paymentData = await fetchDefaultPayment(userId);
      }

      const goal = buildPurchaseGoal(productName, quantity, shipping, paymentData);

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
            paymentAutoFilled: false,
            productName,
            retailerUrl,
            error: result.error ?? "Purchase automation failed",
            statusMessages: result.statusMessages,
            streamingUrl: result.streamingUrl,
          };
        }

        return {
          success: true,
          waitingForPayment: !paymentData,
          paymentAutoFilled: !!paymentData,
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
          paymentAutoFilled: false,
          productName,
          retailerUrl,
          error: error instanceof Error ? error.message : "Unknown error",
          statusMessages: [],
        };
      }
    },
  });
}

async function fetchDefaultPayment(userId: string): Promise<PaymentData | null> {
  try {
    const service = createServiceClient();
    const { data } = await service
      .from("payment_methods")
      .select("encrypted_card_data, exp_month, exp_year")
      .eq("user_id", userId)
      .eq("is_active", true)
      .eq("is_default", true)
      .single();

    if (!data) return null;

    const card = decryptCardData(data.encrypted_card_data);
    return {
      cardNumber: card.cardNumber,
      cvv: card.cvv,
      cardholderName: card.cardholderName,
      expMonth: data.exp_month,
      expYear: data.exp_year,
    };
  } catch {
    return null;
  }
}

function buildPurchaseGoal(
  productName: string,
  quantity: number,
  shipping: z.infer<typeof shippingSchema>,
  payment: PaymentData | null
): string {
  const paymentSteps = payment
    ? `7. FILL IN the payment/credit card information:
   - Card number: ${payment.cardNumber}
   - Cardholder name: ${payment.cardholderName}
   - Expiry: ${String(payment.expMonth).padStart(2, "0")}/${String(payment.expYear).padStart(2, "0")}
   - CVV/CVC: ${payment.cvv}
8. STOP — Do NOT click "Place Order" or any final submit button. Leave the order ready for review.`
    : `7. STOP — Do NOT enter any payment/credit card information. Do NOT submit the order.`;

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
${paymentSteps}

After reaching the ${payment ? "order review" : "payment"} page, extract the order summary as JSON:
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
