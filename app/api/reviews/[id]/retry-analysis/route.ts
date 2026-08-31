import { NextResponse } from "next/server";
import { getCurrentProfile, canManage } from "@/lib/auth/get-current-profile";
import { analyzeAndPersistReview } from "@/lib/gemini/analyze-review";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || !canManage(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await analyzeAndPersistReview(id);
  return NextResponse.json({ ok: true });
}
