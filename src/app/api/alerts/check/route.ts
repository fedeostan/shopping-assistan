import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { scrapeProductDetail } from "@/lib/agentql/queries";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: alerts } = await supabase
    .from("price_alerts")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(5);

  if (!alerts || alerts.length === 0) {
    return Response.json({ alerts: [], message: "No active price alerts." });
  }

  const results = await Promise.allSettled(
    alerts.map(async (alert) => {
      if (!alert.product_url) {
        return { id: alert.id, status: "no_url" as const };
      }

      try {
        const detail = await scrapeProductDetail(alert.product_url);
        const priceDropped = alert.target_price
          ? detail.currentPrice <= alert.target_price
          : alert.current_price && detail.currentPrice < alert.current_price;

        // Update current price in DB
        await supabase
          .from("price_alerts")
          .update({ current_price: detail.currentPrice })
          .eq("id", alert.id);

        return {
          id: alert.id,
          productUrl: alert.product_url,
          targetPrice: alert.target_price,
          previousPrice: alert.current_price,
          currentPrice: detail.currentPrice,
          currency: detail.currency,
          priceDropped: !!priceDropped,
          status: "checked" as const,
        };
      } catch {
        return { id: alert.id, status: "scrape_failed" as const };
      }
    })
  );

  return Response.json({
    alerts: results.map((r) =>
      r.status === "fulfilled" ? r.value : { status: "error" }
    ),
  });
}
