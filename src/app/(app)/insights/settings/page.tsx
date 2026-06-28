"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { InsightsShell } from "@/components/insights/insights-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { InsightConfig } from "@/lib/insightTypes";

export default function InsightsSettingsPage() {
  const [config, setConfig] = React.useState<InsightConfig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    void (async () => {
      try {
        const c = await apiFetch<InsightConfig>("/api/insights/config");
        setConfig(c);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load config");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      const updated = await apiFetch<InsightConfig>("/api/insights/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      setConfig(updated);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function numField(
    key: keyof InsightConfig,
    label: string,
    step = "1"
  ) {
    if (!config) return null;
    const val = config[key];
    if (typeof val !== "number") return null;
    return (
      <div className="space-y-1">
        <Label htmlFor={key}>{label}</Label>
        <Input
          id={key}
          type="number"
          step={step}
          value={val}
          onChange={(e) =>
            setConfig({ ...config, [key]: Number(e.target.value) })
          }
        />
      </div>
    );
  }

  return (
    <InsightsShell
      title="Insights Settings"
      description="Tune ranking weights, thresholds, and digest behaviour."
    >
      {loading ? (
        <Skeleton className="h-64 w-full max-w-xl" />
      ) : config ? (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {numField("severity_weight_critical", "Critical severity weight")}
            {numField("severity_weight_warning", "Warning severity weight")}
            {numField("severity_weight_info", "Info severity weight")}
            {numField("stockout_cover_days", "Stockout cover threshold (days)")}
            {numField("dead_stock_days", "Dead stock threshold (days)")}
            {numField("ordering_cost_default", "Default ordering cost (₹)")}
            {numField("holding_cost_pct_default", "Holding cost %", "0.01")}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="digest_enabled"
                checked={config.digest_enabled}
                onChange={(e) =>
                  setConfig({ ...config, digest_enabled: e.target.checked })
                }
                className="h-4 w-4"
              />
              <Label htmlFor="digest_enabled">Enable scheduled digest</Label>
            </div>
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </InsightsShell>
  );
}
