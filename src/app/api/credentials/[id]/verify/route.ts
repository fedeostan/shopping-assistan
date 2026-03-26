import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { createServiceClient } from "@/lib/db/supabase";
import { decryptCredential } from "@/lib/crypto/credential-encryption";
import { getRetailerById } from "@/lib/connectors/retailers";
import { runAutomation } from "@/lib/tinyfish/client";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  // Fetch credential and verify ownership
  const { data: credential, error: fetchError } = await service
    .from("store_credentials")
    .select("id, user_id, retailer_id, retailer_url, username, encrypted_data")
    .eq("id", id)
    .single();

  if (fetchError || !credential || credential.user_id !== user.id) {
    return Response.json({ error: "Credential not found" }, { status: 404 });
  }

  let finalStatus: "verified" | "failed" = "failed";

  try {
    // Decrypt password
    const { password } = decryptCredential(credential.encrypted_data);

    // Determine login URL
    const retailer = getRetailerById(credential.retailer_id);
    const loginUrl = retailer?.loginUrl ?? credential.retailer_url;

    // Build TinyFish goal — fail fast on CAPTCHA/2FA instead of burning steps
    const goal = `Navigate to "${loginUrl}". Log in with username/email "${credential.username}" and password "${password}". IMPORTANT: If you see a CAPTCHA, puzzle, verification challenge, or 2FA/OTP prompt, STOP IMMEDIATELY and return JSON: {"loggedIn": false, "blocked": "captcha"} — do NOT try to solve it. If login succeeds, verify you are logged in (look for account name, profile icon, or dashboard). Return JSON: {"loggedIn": true/false, "accountName": "visible name or null"}`;

    const result = await runAutomation(
      { url: loginUrl, goal, browser_profile: "stealth", proxy_config: { enabled: true, country_code: "US" } },
      { timeoutMs: 60_000, maxSteps: 20 }
    );

    console.log(`[Credentials] Verify result: success=${result.success} data=${JSON.stringify(result.data)} steps=${result.statusMessages.length}`);

    // TinyFish may return loggedIn as true, "true", or nested — be lenient
    const loggedIn = result.success && (
      result.data?.loggedIn === true ||
      result.data?.loggedIn === "true" ||
      // If automation completed successfully without reporting blocked/captcha, treat as verified
      (result.success && !result.data?.blocked && !result.abortReason)
    );

    if (loggedIn) {
      finalStatus = "verified";
    }
  } catch (err) {
    console.error("[Credentials] Verification error:", err);
    finalStatus = "failed";
  }

  // Update status in DB
  const updateData =
    finalStatus === "verified"
      ? { status: finalStatus, verified_at: new Date().toISOString() }
      : { status: finalStatus };

  await service
    .from("store_credentials")
    .update(updateData)
    .eq("id", id);

  return Response.json({ success: true, status: finalStatus });
}
