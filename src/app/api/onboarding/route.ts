import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { initializePersona } from "@/lib/persona/engine";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // body: { budgetRange, categories, brands, qualityVsPrice, household, shoppingFrequency, retailers }

  // Map qualityVsPrice (1-5) to priceQualitySpectrum (-1 to 1)
  const priceQualitySpectrum = body.qualityVsPrice
    ? (body.qualityVsPrice - 3) / 2
    : 0;

  // Map household to householdSize
  const householdSizes: Record<string, number> = {
    "living-alone": 1,
    couple: 2,
    family: 4,
    shared: 3,
  };

  // Parse brands from comma-separated string
  const brandList = (body.brands ?? "")
    .split(",")
    .map((b: string) => b.trim())
    .filter(Boolean);

  await initializePersona(user.id, {
    currency: "USD",
    locale: "en",
    householdSize: householdSizes[body.household] ?? 1,
    priceQualitySpectrum,
    preferredRetailers: body.retailers ?? [],
    brandAffinities: Object.fromEntries(
      brandList.map((b: string) => [b, 0.8])
    ),
    categoryInterests: Object.fromEntries(
      (body.categories ?? []).map((c: string) => [c, 1.0])
    ),
    averageOrderValue:
      body.budgetRange === "under-50"
        ? 30
        : body.budgetRange === "50-200"
          ? 125
          : body.budgetRange === "200-500"
            ? 350
            : body.budgetRange === "500+"
              ? 750
              : undefined,
  });

  return Response.json({ success: true });
}
