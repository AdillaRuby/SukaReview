import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/common/logo";

// Set to false to re-enable the login/sign-up page for everyone.
const LOGIN_DISABLED = true;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const bypassCode = process.env.LOGIN_BYPASS_CODE;
  const bypassed = Boolean(bypassCode) && params.bypass === bypassCode;

  const supabase = await createClient();

  // Silently sign the bypass account in — no form, no password on the wire.
  if (bypassed && process.env.LOGIN_BYPASS_EMAIL) {
    const admin = createAdminClient();
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: process.env.LOGIN_BYPASS_EMAIL,
    });
    const hashedToken = linkData?.properties?.hashed_token;

    if (linkError) {
      console.error("[login-bypass] generateLink failed:", linkError.message);
    } else if (!hashedToken) {
      console.error("[login-bypass] generateLink returned no hashed_token");
    } else {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash: hashedToken,
      });
      if (verifyError) {
        console.error("[login-bypass] verifyOtp failed:", verifyError.message);
      } else {
        redirect("/dashboard");
      }
    }
  } else if (bypassed && !process.env.LOGIN_BYPASS_EMAIL) {
    console.error("[login-bypass] LOGIN_BYPASS_EMAIL is not set");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  const showForm = !LOGIN_DISABLED || bypassed;

  return (
    <div
      className="flex min-h-dvh items-center justify-center px-4"
      style={{
        background:
          "radial-gradient(circle at 20% 15%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 55%), radial-gradient(circle at 85% 85%, color-mix(in srgb, var(--primary) 14%, transparent), transparent 55%), var(--background)",
      }}
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-7 shadow-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo variant="full" size={128} className="mb-2" />
          <p className="font-display text-xl font-bold tracking-tight text-foreground">SukaReview</p>
          <p className="mt-1 text-xs text-muted-foreground">Suka Shawarma Review Monitor</p>
        </div>
        {showForm ? (
          <Suspense>
            <LoginForm />
          </Suspense>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Login sedang dinonaktifkan sementara. Hubungi admin untuk informasi lebih lanjut.
          </p>
        )}
      </div>
    </div>
  );
}
