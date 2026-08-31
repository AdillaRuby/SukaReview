"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/** Dev-only affordance, only rendered by the dashboard page when GOOGLE_MODE=demo. */
export function SimulateReviewButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/dev/simulate-review", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal simulasi review");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal simulasi review");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-30">
      <Button onClick={handleClick} disabled={loading} variant="secondary" size="sm" className="shadow-lg">
        <Sparkles className="size-4 text-accent" />
        {loading ? "Mengirim..." : "Simulate New Review"}
      </Button>
    </div>
  );
}
