"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupDone, setSignupDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError("Email atau password salah.");
        setLoading(false);
        return;
      }
      router.push(searchParams.get("next") || "/dashboard");
      router.refresh();
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setSignupDone(true);
      setLoading(false);
    }
  }

  if (signupDone) {
    return (
      <div className="text-center text-sm text-muted-foreground">
        <p className="mb-2 text-foreground">Akun berhasil dibuat.</p>
        <p>Cek email kamu untuk verifikasi, lalu sign in.</p>
        <Button variant="link" className="mt-2" onClick={() => { setSignupDone(false); setMode("signin"); }}>
          Kembali ke Sign In
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {mode === "signup" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Nama Lengkap</label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Nama kamu" />
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="nama@sukashawarma.com"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Password</label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          placeholder="••••••••"
        />
      </div>

      {error && <p className="text-xs text-negative-foreground">{error}</p>}

      <Button type="submit" disabled={loading} className="mt-1">
        {loading && <Loader2 className="size-4 animate-spin" />}
        {mode === "signin" ? "Sign In" : "Sign Up"}
      </Button>

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="text-center text-xs text-muted-foreground hover:text-foreground"
      >
        {mode === "signin" ? "Belum punya akun? Sign Up" : "Sudah punya akun? Sign In"}
      </button>
    </form>
  );
}
