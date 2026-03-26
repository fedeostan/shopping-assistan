"use client";

import { useState, useEffect, useCallback } from "react";
import { Store, Radio, Settings, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CredentialItem } from "@/components/credentials/credential-card";

interface ConnectorsPanelProps {
  activeConnectors: string[];
  onToggle: (retailerId: string, active: boolean) => void;
  targetedRetailer: string | null;
  onTargetSelect: (retailerId: string | null) => void;
}

export function ConnectorsPanel({
  activeConnectors,
  onToggle,
  targetedRetailer,
  onTargetSelect,
}: ConnectorsPanelProps) {
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"toggle" | "targeted">("toggle");

  const fetchCredentials = useCallback(async () => {
    try {
      const res = await fetch("/api/credentials");
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setCredentials(
          json.data.filter((c: CredentialItem) => c.status === "verified")
        );
      }
    } catch {
      // silently fail — panel just shows empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (credentials.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <Store className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No store credentials configured.
        </p>
        <Button variant="outline" size="sm" asChild>
          <a href="/profile/credentials">
            <Settings className="size-4" />
            Add in Settings
          </a>
        </Button>
      </div>
    );
  }

  const activeCount = activeConnectors.length;

  if (mode === "targeted") {
    return (
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Targeted Search</p>
          <p className="text-xs text-muted-foreground">
            Search one store only (next search)
          </p>
        </div>

        <div className="flex flex-col gap-1">
          {credentials.map((cred) => {
            const isSelected = targetedRetailer === cred.retailer_id;
            return (
              <button
                key={cred.id}
                type="button"
                onClick={() => {
                  onTargetSelect(isSelected ? null : cred.retailer_id);
                  setMode("toggle");
                }}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  isSelected
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent"
                }`}
              >
                <Radio
                  className={`size-4 shrink-0 ${
                    isSelected ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <Store className="size-4 shrink-0 text-purple-400" />
                <span className="truncate">{cred.retailer_name}</span>
              </button>
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMode("toggle")}
          className="self-start"
        >
          Back to toggles
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Connectors</p>
        <Badge variant="secondary" className="text-xs">
          {activeCount} active
        </Badge>
      </div>

      <div className="flex flex-col gap-1">
        {credentials.map((cred) => (
          <label
            key={cred.id}
            className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent"
          >
            <Store className="size-4 shrink-0 text-purple-400" />
            <span className="flex-1 truncate text-sm">
              {cred.retailer_name}
            </span>
            <Switch
              checked={activeConnectors.includes(cred.retailer_id)}
              onCheckedChange={(checked: boolean) =>
                onToggle(cred.retailer_id, checked)
              }
              size="sm"
            />
          </label>
        ))}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setMode("targeted")}
        className="self-start"
      >
        Targeted Search &rarr;
      </Button>
    </div>
  );
}
