import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { createServiceClient } from "@/lib/db/supabase";
import { initializePersona } from "@/lib/persona/engine";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Ensure user exists in public.users (FK target for user_personas)
  const serviceClient = createServiceClient();
  await serviceClient.from("users").upsert(
    { id: user.id, email: user.email },
    { onConflict: "id" }
  );

  try {
    await initializePersona(user.id, {
      // Identity
      locale: body.locale ?? "en",
      currency: body.currency ?? "USD",
      country: body.country ?? "US",
      householdSize: body.householdSize ?? 1,
      lifeStage: body.lifeStage,

      // Shopping DNA
      brandAffinities: body.brandAffinities ?? {},
      priceQualitySpectrum: body.priceQualitySpectrum ?? 0,
      preferredRetailers: body.preferredRetailers ?? [],
      sizeData: body.sizeData ?? {},

      // Behavioral signals
      categoryInterests: body.categoryInterests ?? {},
      featurePreferences: body.featurePreferences ?? {},
      promotionResponsiveness: body.promotionResponsiveness,
      averageOrderValue: body.averageOrderValue,
    });
  } catch (err) {
    console.error("Onboarding persona init failed:", err);
    return Response.json(
      { error: "Failed to save preferences. Please try again." },
      { status: 500 }
    );
  }

  return Response.json({ success: true });
}
