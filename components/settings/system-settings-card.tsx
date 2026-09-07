"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface AlertSettingsData {
  low_outlet_rating_threshold: number;
  urgent_review_rating_threshold: number;
  negative_spike_count: number;
  negative_spike_window_hours: number;
  rating_drop_threshold: number;
  notify_email_enabled: boolean;
  notify_email: string | null;
}

export function SystemSettingsCard({ initial }: { initial: AlertSettingsData }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("alert_settings")
      .update({ ...values, updated_by: user?.id })
      .eq("id", true);

    setSaving(false);
    if (error) {
      toast.error("Gagal menyimpan pengaturan.");
    } else {
      toast.success("Pengaturan disimpan.");
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>System — Alert Thresholds</CardTitle>
        <CardDescription>Aturan yang memicu alert otomatis di seluruh outlet.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field
          label="Alert jika rating outlet di bawah"
          value={values.low_outlet_rating_threshold}
          step={0.1}
          onChange={(v) => setValues((s) => ({ ...s, low_outlet_rating_threshold: v }))}
          suffix="⭐"
        />
        <Field
          label="Urgent review threshold (≤ bintang)"
          value={values.urgent_review_rating_threshold}
          step={1}
          onChange={(v) => setValues((s) => ({ ...s, urgent_review_rating_threshold: v }))}
          suffix="⭐"
        />
        <Field
          label="Negative spike — jumlah review"
          value={values.negative_spike_count}
          step={1}
          onChange={(v) => setValues((s) => ({ ...s, negative_spike_count: v }))}
        />
        <Field
          label="Negative spike — dalam (jam)"
          value={values.negative_spike_window_hours}
          step={1}
          onChange={(v) => setValues((s) => ({ ...s, negative_spike_window_hours: v }))}
        />
        <Field
          label="Rating drop threshold (7 hari)"
          value={values.rating_drop_threshold}
          step={0.1}
          onChange={(v) => setValues((s) => ({ ...s, rating_drop_threshold: v }))}
        />

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Kirim ke Email</p>
              <p className="text-xs text-muted-foreground">
                Kirim email saat review baru masuk dengan rating ≤ {values.urgent_review_rating_threshold}⭐ (pakai
                threshold "Urgent review" di atas).
              </p>
            </div>
            <Switch
              checked={values.notify_email_enabled}
              onCheckedChange={(v) => setValues((s) => ({ ...s, notify_email_enabled: v }))}
            />
          </div>
          {values.notify_email_enabled && (
            <Input
              type="email"
              placeholder="owner@email.com"
              value={values.notify_email ?? ""}
              onChange={(e) => setValues((s) => ({ ...s, notify_email: e.target.value }))}
            />
          )}
        </div>

        <Button onClick={handleSave} disabled={saving} className="self-start">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm text-foreground">{label}</label>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-24"
        />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}
