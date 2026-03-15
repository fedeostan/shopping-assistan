import { tool } from "ai";
import { z } from "zod";
import { runAutomation, type TinyFishResult } from "@/lib/tinyfish/client";
import { createServiceClient } from "@/lib/db/supabase";
import { decryptCardData } from "@/lib/crypto/card-encryption";
import { logInteraction } from "@/lib/persona/engine";
import { extractPurchaseSignals } from "@/lib/persona/signals";
import { CircuitOpenError } from "@/lib/utils/service-error";

// ---------------------------------------------------------------------------
// Schemas & types
// ---------------------------------------------------------------------------

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

export type PurchaseFailureReason =
  | "timeout"
  | "loop_detected"
  | "step_limit_exceeded"
  | "sign_in_required"
  | "captcha_blocked"
  | "out_of_stock"
  | "cart_empty"
  | "geo_blocked"
  | "unknown";

const SUPPORTED_PROXY_COUNTRIES = new Set(["US", "GB", "CA", "DE", "FR", "JP", "AU"]);

function detectPaymentFilled(statusMessages: string[]): boolean {
  const paymentPatterns = [
    /card\s*number/i, /credit\s*card/i, /cvv/i, /cvc/i,
    /expir/i, /cardholder/i, /name\s*on\s*card/i,
  ];
  const actionPatterns = [/fill/i, /enter/i, /type/i, /input/i];

  return statusMessages.some(msg =>
    paymentPatterns.some(p => p.test(msg)) &&
    actionPatterns.some(a => a.test(msg))
  );
}

function isGoogleShoppingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.includes("google.") &&
      (u.pathname.includes("/shopping/") || u.pathname.includes("/product/") ||
       u.searchParams.has("prds") || u.searchParams.has("tbm"));
  } catch { return false; }
}

const RETRYABLE_REASONS = new Set<PurchaseFailureReason>([
  "loop_detected",
  "step_limit_exceeded",
  "sign_in_required",
  "cart_empty",
]);

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export function createPurchase(userId: string | null) {
  return tool({
    description:
      "Navigate to a product page, add the item to cart, fill in shipping details, and proceed to payment. Accepts Google Shopping URLs (auto-clicks 'Visit store') or direct retailer URLs. If the user has a saved default card and usePaymentMethod is true, auto-fills payment details. Otherwise stops at the payment page and returns a live browser URL.",
    inputSchema: z.object({
      productUrl: z
        .string()
        .url()
        .describe(
          "URL to the product page — can be a Google Shopping link or a direct retailer URL"
        ),
      productName: z
        .string()
        .describe("Name of the product (for display and goal context)"),
      quantity: z
        .number()
        .optional()
        .default(1)
        .describe("Number of items to add"),
      shipping: shippingSchema.optional().describe("Shipping address — omit to use saved address"),
      usePaymentMethod: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to auto-fill saved payment method"),
      proxyCountry: z
        .string()
        .optional()
        .describe(
          "Two-letter country code for proxy routing (US, GB, CA, DE, FR, JP, AU). Auto-derived from shipping country when supported."
        ),
    }),
    execute: async ({
      productUrl,
      productName,
      quantity,
      shipping,
      usePaymentMethod,
      proxyCountry,
    }) => {
      console.log(`[Tool:purchase] START product="${productName}" productUrl=${productUrl} quantity=${quantity} usePayment=${usePaymentMethod} proxy=${proxyCountry ?? "auto"}`);
      const t0 = Date.now();

      // Resolve shipping: use provided or fetch saved default
      let resolvedShipping = shipping;
      if (!resolvedShipping && userId) {
        console.log(`[Tool:purchase] Fetching saved shipping for userId=${userId}`);
        resolvedShipping = (await fetchDefaultShipping(userId)) ?? undefined;
        console.log(`[Tool:purchase] Saved shipping: ${resolvedShipping ? `${resolvedShipping.fullName}, ${resolvedShipping.city}, ${resolvedShipping.country}` : "NOT_FOUND"}`);
      }
      if (!resolvedShipping) {
        console.warn(`[Tool:purchase] ABORT — no shipping address`);
        return {
          success: false,
          waitingForPayment: false,
          paymentAutoFilled: false,
          productName,
          productUrl,
          error: "No shipping address provided. Please save your shipping address at /profile.",
          statusMessages: [],
        };
      }

      // Try to fetch saved payment method
      let paymentData: PaymentData | null = null;
      if (userId && usePaymentMethod) {
        console.log(`[Tool:purchase] Fetching saved payment for userId=${userId}`);
        paymentData = await fetchDefaultPayment(userId);
        console.log(`[Tool:purchase] Payment: ${paymentData ? `card ending ${paymentData.cardNumber.slice(-4)}` : "NOT_FOUND"}`);
      }

      // Resolve proxy country
      const resolvedProxy = resolveProxy(proxyCountry, resolvedShipping.country);
      console.log(`[Tool:purchase] Proxy: ${resolvedProxy ? `${resolvedProxy.country} (enabled)` : "none"}`);

      const isGoogleShopping = isGoogleShoppingUrl(productUrl);
      const goal = buildPurchaseGoal(productName, quantity, resolvedShipping, paymentData, isGoogleShopping);
      console.log(`[Tool:purchase] Goal built, launching TinyFish automation...`);

      try {
        // First attempt
        let result = await runAutomation(
          {
            url: productUrl,
            goal,
            browser_profile: "stealth",
            ...(resolvedProxy && { proxy_config: resolvedProxy }),
          },
        );

        console.log(`[Tool:purchase] First attempt: success=${result.success} steps=${result.statusMessages.length} streamUrl=${result.streamingUrl ?? "none"} elapsed=${Date.now() - t0}ms`);

        // Semantic retry: if first attempt fails with a retryable reason, try once more
        if (!result.success) {
          const failureReason = classifyFailure(result);
          console.log(`[Tool:purchase] First attempt failed: reason=${failureReason} error="${result.error}" abortReason=${result.abortReason ?? "none"}`);
          if (RETRYABLE_REASONS.has(failureReason)) {
            console.log(
              `[Tool:purchase] RETRYING after ${failureReason} — adjusting goal`
            );
            const retryGoal = buildRetryGoal(
              failureReason,
              result.statusMessages,
              goal
            );
            result = await runAutomation(
              {
                url: productUrl,
                goal: retryGoal,
                browser_profile: "stealth",
                ...(resolvedProxy && { proxy_config: resolvedProxy }),
              },
            );
            console.log(`[Tool:purchase] Retry result: success=${result.success} steps=${result.statusMessages.length} elapsed=${Date.now() - t0}ms`);
          }
        }

        if (!result.success) {
          const failureReason = classifyFailure(result);
          console.error(`[Tool:purchase] FAILED product="${productName}" reason=${failureReason} error="${result.error}" totalElapsed=${Date.now() - t0}ms`);
          return {
            success: false,
            waitingForPayment: false,
            paymentAutoFilled: false,
            productName,
            productUrl,
            failureReason,
            error: result.error ?? "Purchase automation failed",
            statusMessages: result.statusMessages,
            streamingUrl: result.streamingUrl,
          };
        }

        const paymentWasFilled = !!paymentData && detectPaymentFilled(result.statusMessages);
        console.log(`[Tool:purchase] SUCCESS product="${productName}" paymentFilled=${paymentWasFilled} orderSummary=${JSON.stringify(result.data)} elapsed=${Date.now() - t0}ms`);

        // Log purchase signals for persona learning
        if (userId) {
          let source: string;
          try {
            source = isGoogleShopping ? "google-shopping" : new URL(productUrl).hostname;
          } catch {
            source = "unknown";
          }
          const signals = extractPurchaseSignals({
            brand: undefined,
            category: undefined,
            price: result.data?.total ? parseFloat(String(result.data.total)) : 0,
            source,
          });
          logInteraction({
            userId,
            type: "purchase",
            payload: { productName, productUrl, quantity, orderSummary: result.data },
            personaSignals: signals,
          }).catch(console.error);
        }

        return {
          success: true,
          waitingForPayment: !paymentData,
          paymentAutoFilled: paymentWasFilled,
          paymentFillFailed: !!paymentData && !paymentWasFilled,
          productName,
          productUrl,
          quantity,
          streamingUrl: result.streamingUrl,
          orderSummary: result.data,
          statusMessages: result.statusMessages,
        };
      } catch (error) {
        if (error instanceof CircuitOpenError) {
          console.warn(`[Tool:purchase] CIRCUIT_OPEN product="${productName}": ${error.userMessage}`);
          return {
            success: false,
            waitingForPayment: false,
            paymentAutoFilled: false,
            productName,
            productUrl,
            error: error.userMessage,
            circuitOpen: true,
            failureReason: "unknown" as PurchaseFailureReason,
            statusMessages: [],
          };
        }
        console.error(`[Tool:purchase] EXCEPTION product="${productName}" elapsed=${Date.now() - t0}ms:`, error instanceof Error ? error.message : error);
        return {
          success: false,
          waitingForPayment: false,
          paymentAutoFilled: false,
          productName,
          productUrl,
          failureReason: "unknown" as PurchaseFailureReason,
          error: error instanceof Error ? error.message : "Unknown error",
          statusMessages: [],
        };
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Failure classification
// ---------------------------------------------------------------------------

function classifyFailure(result: TinyFishResult): PurchaseFailureReason {
  // Check abort reason from the client first
  if (result.abortReason) {
    switch (result.abortReason) {
      case "timeout":
        return "timeout";
      case "loop_detected":
        return "loop_detected";
      case "step_limit":
        return "step_limit_exceeded";
    }
  }

  const text = [
    result.error ?? "",
    ...result.statusMessages,
  ]
    .join(" ")
    .toLowerCase();

  if (/captcha|recaptcha|hcaptcha|verify.+human/.test(text)) return "captcha_blocked";
  if (/sign.?in|log.?in|create.+account|password required/.test(text)) return "sign_in_required";
  if (/out of stock|unavailable|sold out|no longer available/.test(text)) return "out_of_stock";
  if (/cart.+(empty|0 item)|no items in.+cart/.test(text)) return "cart_empty";
  if (/geo.?block|not available in your (region|country)|access denied.+location/.test(text))
    return "geo_blocked";

  return "unknown";
}

// ---------------------------------------------------------------------------
// Proxy resolution
// ---------------------------------------------------------------------------

function resolveProxy(
  explicit: string | undefined,
  shippingCountry: string
): { enabled: boolean; country: string } | undefined {
  const country = explicit ?? shippingCountry;
  if (SUPPORTED_PROXY_COUNTRIES.has(country.toUpperCase())) {
    return { enabled: true, country: country.toUpperCase() };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Goal prompts
// ---------------------------------------------------------------------------

function buildPurchaseGoal(
  productName: string,
  quantity: number,
  shipping: z.infer<typeof shippingSchema>,
  payment: PaymentData | null,
  isGoogleShopping: boolean = false
): string {
  const paymentSteps = payment
    ? `7. FILL IN the payment/credit card information:
   - Card number: ${payment.cardNumber}
   - Cardholder name: ${payment.cardholderName}
   - Expiry: ${String(payment.expMonth).padStart(2, "0")}/${String(payment.expYear).padStart(2, "0")}
   - CVV/CVC: ${payment.cvv}
8. STOP — Do NOT click "Place Order" or any final submit button. Leave the order ready for review.`
    : `7. STOP — Do NOT enter any payment/credit card information. Do NOT submit the order.`;

  const googleShoppingStep = isGoogleShopping
    ? `0. You are on a Google Shopping product page. Find and click the "Visit store", "Visit site", or merchant/retailer link to navigate to the actual retailer website. Wait for the retailer page to load fully. Then proceed with Step 1 on the retailer site.\n`
    : "";

  const actionLimit = isGoogleShopping ? 40 : 35;

  return `You are a shopping assistant automating a purchase. Follow the RULES, then execute the STEPS.

=== RULES (always obey) ===
- Never reconfigure the browser or change any browser settings mid-flow.
- Always use guest checkout. Never create an account.
- Dismiss cookie consent banners, newsletter popups, and age verification modals immediately.
- If a sign-in wall appears: look for "Guest Checkout", "Continue as Guest", or "Skip" buttons first. If none exist, enter the email address without a password and try to continue.
- If a CAPTCHA appears: STOP immediately and report "captcha_blocked".
- Never navigate away from the retailer's domain${isGoogleShopping ? " (after leaving Google Shopping)" : ""}.
- Never click social sign-in buttons (Google, Facebook, Apple, etc.).
- If an item is out of stock, STOP and report "out_of_stock".

=== STEPS ===
${googleShoppingStep}1. FIND the product "${productName}" on this page. If it's already the product page, proceed.
2. SELECT size/color: pick the first in-stock option. If it seems unresponsive after 2 attempts, try a different size/color.
3. ADD ${quantity} item(s) to the shopping cart.
4. VERIFY the cart contains the item. If the cart is empty or shows 0 items, go back and re-add.
5. PROCEED to checkout. Use guest checkout if prompted to sign in.
6. FILL IN the shipping information:
   - Full name: ${shipping.fullName}
   - Email: ${shipping.email}
   ${shipping.phone ? `- Phone: ${shipping.phone}` : ""}
   - Address: ${shipping.address1}
   ${shipping.address2 ? `- Address line 2: ${shipping.address2}` : ""}
   - City: ${shipping.city}
   - State: ${shipping.state}
   - ZIP: ${shipping.zip}
   - Country: ${shipping.country}
   Select the cheapest available shipping method.
${paymentSteps}

=== CONSTRAINTS ===
- Complete in at most ${actionLimit} actions.
- If stuck on any single step for 5+ actions, skip it or STOP with a status report.
- Never click "Place Order" or any final purchase/submit button.

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

function buildRetryGoal(
  reason: PurchaseFailureReason,
  statusMessages: string[],
  originalGoal: string
): string {
  const lastFew = statusMessages.slice(-5).join("\n  - ");
  let hint = "";

  switch (reason) {
    case "loop_detected":
      hint =
        "The previous attempt got stuck in a loop. Try a different approach for the step that was repeating. If a button is not responding, look for an alternative path.";
      break;
    case "step_limit_exceeded":
      hint =
        "The previous attempt took too many steps. Be more direct — skip optional steps and go straight to checkout.";
      break;
    case "sign_in_required":
      hint =
        "The previous attempt was blocked by a sign-in wall. Try harder to find guest checkout. Look for 'Continue as Guest', 'Checkout as Guest', or simply enter the email address and continue without a password.";
      break;
    case "cart_empty":
      hint =
        "The cart was empty during checkout. Make sure to verify the item is in the cart before navigating to checkout. Try adding the item again.";
      break;
    default:
      hint = "The previous attempt failed. Try a different approach.";
  }

  return `${hint}

Previous attempt status:
  - ${lastFew || "No status messages"}

${originalGoal}`;
}

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------

async function fetchDefaultPayment(userId: string): Promise<PaymentData | null> {
  try {
    const service = createServiceClient();
    const { data, error } = await service
      .from("payment_methods")
      .select("encrypted_card_data, exp_month, exp_year")
      .eq("user_id", userId)
      .eq("is_active", true)
      .eq("is_default", true)
      .single();

    if (error) {
      console.warn(`[Purchase:Payment] DB error fetching payment for userId=${userId}: ${error.message}`);
      return null;
    }
    if (!data) {
      console.log(`[Purchase:Payment] No default payment method for userId=${userId}`);
      return null;
    }

    const card = decryptCardData(data.encrypted_card_data);
    console.log(`[Purchase:Payment] Decrypted card for userId=${userId} — cardholder=${card.cardholderName} exp=${data.exp_month}/${data.exp_year}`);
    return {
      cardNumber: card.cardNumber,
      cvv: card.cvv,
      cardholderName: card.cardholderName,
      expMonth: data.exp_month,
      expYear: data.exp_year,
    };
  } catch (err) {
    console.error(`[Purchase:Payment] EXCEPTION fetching payment for userId=${userId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function fetchDefaultShipping(
  userId: string
): Promise<z.infer<typeof shippingSchema> | null> {
  try {
    const service = createServiceClient();
    const { data, error } = await service
      .from("users")
      .select(
        "shipping_full_name, shipping_email, shipping_phone, shipping_address1, shipping_address2, shipping_city, shipping_state, shipping_zip, shipping_country"
      )
      .eq("id", userId)
      .single();

    if (error) {
      console.warn(`[Purchase:Shipping] DB error fetching shipping for userId=${userId}: ${error.message}`);
      return null;
    }

    if (!data?.shipping_full_name || !data?.shipping_address1) {
      console.log(`[Purchase:Shipping] Missing required fields for userId=${userId} — name=${!!data?.shipping_full_name} address=${!!data?.shipping_address1}`);
      return null;
    }

    console.log(`[Purchase:Shipping] Found shipping for userId=${userId}: ${data.shipping_full_name}, ${data.shipping_city}, ${data.shipping_country}`);
    return {
      fullName: data.shipping_full_name,
      email: data.shipping_email ?? "",
      phone: data.shipping_phone ?? undefined,
      address1: data.shipping_address1,
      address2: data.shipping_address2 ?? undefined,
      city: data.shipping_city ?? "",
      state: data.shipping_state ?? "",
      zip: data.shipping_zip ?? "",
      country: data.shipping_country ?? "US",
    };
  } catch (err) {
    console.error(`[Purchase:Shipping] EXCEPTION fetching shipping for userId=${userId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
