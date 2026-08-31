import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getCurrentProfile, canManage } from "@/lib/auth/get-current-profile";
import { buildAuthorizationUrl, isLiveMode } from "@/lib/google/auth";

const STATE_COOKIE = "sukareview_oauth_state";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || !canManage(profile.role)) {
    return NextResponse.redirect(new URL("/settings", process.env.NEXT_PUBLIC_APP_URL));
  }

  if (!isLiveMode()) {
    return NextResponse.redirect(new URL("/settings?error=demo_mode", process.env.NEXT_PUBLIC_APP_URL));
  }

  const state = randomBytes(16).toString("hex");
  const response = NextResponse.redirect(buildAuthorizationUrl(state));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
