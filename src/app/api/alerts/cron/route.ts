import { createServiceClient } from "@/lib/db/supabase";
import { scrapeProductDetail } from "@/lib/agentql/queries";

const MAX_CONCURRENT = 10;

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Fetch all active alerts across all users
  const { data: alerts, error } = await supabase
    .from("price_alerts")
    .select("*")
    .eq("is_active", true);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!alerts || alerts.length === 0) {
    return Response.json({ checked: 0, drops: 0, errors: 0 });
  }

  let drops = 0;
  let errors = 0;

  // Process in batches of MAX_CONCURRENT
  for (let i = 0; i < alerts.length; i += MAX_CONCURRENT) {
    const batch = alerts.slice(i, i + MAX_CONCURRENT);

    const results = await Promise.allSettled(
      batch.map(async (alert) => {
        try {
          if (!alert.product_url) return;

          const detail = await scrapeProductDetail(alert.product_url);
          const currentPrice = detail.currentPrice;

          // Update current price
          await supabase
            .from("price_alerts")
            .update({ current_price: currentPrice })
            .eq("id", alert.id);

          // Check for price drop
          const priceDropped = alert.target_price
            ? currentPrice <= alert.target_price
            : alert.current_price && currentPrice < alert.current_price;

          if (priceDropped) {
            drops++;

            // Insert notification
            await supabase.from("notifications").insert({
              user_id: alert.user_id,
              type: "price_drop",
              title: "Price dropped!",
              body: `Price dropped from ${alert.currency ?? "$"}${alert.current_price} to ${alert.currency ?? "$"}${currentPrice}`,
              metadata: {
                alert_id: alert.id,
                product_url: alert.product_url,
                previous_price: alert.current_price,
                current_price: currentPrice,
                target_price: alert.target_price,
              },
            });
          }
        } catch (err) {
          errors++;
          console.error(`Failed to check alert ${alert.id}:`, err);
        }
      })
    );

    // Count rejected promises (shouldn't happen with inner try/catch, but be safe)
    for (const r of results) {
      if (r.status === "rejected") errors++;
    }
  }

  return Response.json({
    checked: alerts.length,
    drops,
    errors,
  });
}
