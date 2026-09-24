import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Route Handler, not a Server Component — this is the one place in the app
// allowed to write auth cookies. The old /login page tried to do this
// magic-link sign-in inline in a Server Component; Next.js silently refuses
// cookie writes there (see lib/supabase/server.ts's setAll catch), so the
// session never actually reached the browser even though verifyOtp()
// reported success. Moving the whole flow here is the fix, not a rewrite
// for its own sake.
//
// Each bypass code is a fixed pairing with ONE email — not one generic code
// for any email — so admin and owner can land on two different SukaReview
// accounts, each keeping its own role in the profiles table.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  const bypassPairs: Array<{ code?: string; email?: string }> = [
    { code: process.env.LOGIN_BYPASS_CODE_ADMIN, email: process.env.LOGIN_BYPASS_EMAIL_ADMIN },
    { code: process.env.LOGIN_BYPASS_CODE_OWNER, email: process.env.LOGIN_BYPASS_EMAIL_OWNER },
  ];
  const matched = bypassPairs.find((pair) => pair.code && pair.email && code === pair.code);

  if (!matched?.email) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const admin = createAdminClient();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: matched.email,
  });
  const hashedToken = linkData?.properties?.hashed_token;

  if (linkError) {
    console.error("[login-bypass] generateLink failed:", linkError.message);
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!hashedToken) {
    console.error("[login-bypass] generateLink returned no hashed_token");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: hashedToken,
  });

  if (verifyError) {
    console.error("[login-bypass] verifyOtp failed:", verifyError.message);
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
