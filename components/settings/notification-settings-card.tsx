"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Volume2 } from "lucide-react";
import { useNotificationPreferences } from "@/components/providers/notification-preferences-provider";

export function NotificationSettingsCard() {
  const { hydrated, prefs, testSound, setSoundEnabled, setSoundVolume, setRatingTrigger } =
    useNotificationPreferences();

  if (!hydrated) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Sound</CardTitle>
        <CardDescription>Atur suara notifikasi saat review baru masuk.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Sound</p>
            <p className="text-xs text-muted-foreground">{prefs.soundEnabled ? "ON" : "OFF"}</p>
          </div>
          <Switch checked={prefs.soundEnabled} onCheckedChange={setSoundEnabled} />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Notify me for</p>
          <Select
            value={String(prefs.ratingTrigger)}
            onChange={(e) => {
              const v = e.target.value;
              setRatingTrigger(v === "all" ? "all" : (Number(v) as 1 | 2 | 3));
            }}
            className="max-w-xs"
          >
            <option value="all">All Reviews</option>
            <option value="3">≤ 3 Stars</option>
            <option value="2">≤ 2 Stars</option>
            <option value="1">1 Star Only</option>
          </Select>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Volume</p>
            <span className="font-mono text-xs text-muted-foreground">{Math.round(prefs.soundVolume * 100)}%</span>
          </div>
          <Slider
            value={[prefs.soundVolume * 100]}
            max={100}
            step={5}
            onValueChange={([v]) => setSoundVolume(v / 100)}
          />
        </div>

        <Button variant="secondary" size="sm" className="self-start" onClick={testSound}>
          <Volume2 className="size-4" /> Test Sound
        </Button>
      </CardContent>
    </Card>
  );
}
