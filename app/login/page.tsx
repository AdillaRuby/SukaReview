import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/common/logo";

// Set to false to re-enable the login/sign-up page for everyone.
// The bypass flow (admin/owner auto-login from app.sukashawarma.com) lives
// entirely in /api/auth/bypass — a Route Handler, not this Server Component,
// because Server Components can't write auth cookies. This page never
// unlocks itself from a query param; that was the old (broken) design.
const LOGIN_DISABLED = true;

export default async function LoginPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  const showForm = !LOGIN_DISABLED;

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
