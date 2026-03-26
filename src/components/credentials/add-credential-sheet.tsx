"use client";

import { useState } from "react";
import { ArrowLeft, Shield } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RetailerGrid } from "@/components/credentials/retailer-grid";
import { getRetailerById } from "@/lib/connectors/retailers";

interface AddCredentialSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingRetailerIds: string[];
  onSaved: () => void;
}

export function AddCredentialSheet({
  open,
  onOpenChange,
  existingRetailerIds,
  onSaved,
}: AddCredentialSheetProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRetailerId, setSelectedRetailerId] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCustom = selectedRetailerId === "custom";
  const retailer = selectedRetailerId && !isCustom
    ? getRetailerById(selectedRetailerId)
    : null;

  function resetState() {
    setStep(1);
    setSelectedRetailerId(null);
    setCustomName("");
    setCustomUrl("");
    setUsername("");
    setPassword("");
    setSaving(false);
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetState();
    }
    onOpenChange(nextOpen);
  }

  function handleSelectRetailer(retailerId: string) {
    setSelectedRetailerId(retailerId);
    setError(null);
    setStep(2);
  }

  function handleBack() {
    setSelectedRetailerId(null);
    setUsername("");
    setPassword("");
    setCustomName("");
    setCustomUrl("");
    setError(null);
    setStep(1);
  }

  async function handleSave() {
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError("Username and password are required.");
      return;
    }
    if (isCustom && (!customName.trim() || !customUrl.trim())) {
      setError("Store name and URL are required for custom stores.");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, string> = {
        username: username.trim(),
        password: password.trim(),
      };

      if (isCustom) {
        body.retailerId = `custom_${Date.now()}`;
        body.retailerName = customName.trim();
        body.retailerUrl = customUrl.trim();
      } else {
        body.retailerId = selectedRetailerId!;
      }

      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to save credential");
      }

      const result = await res.json();
      const credId = result.data?.id;

      // Fire background verification (don't await)
      if (credId) {
        fetch(`/api/credentials/${credId}/verify`, { method: "POST" }).catch(() => {});
      }

      onSaved();
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const title = step === 1
    ? "Select a Store"
    : isCustom
      ? "Add Custom Store"
      : `Add ${retailer?.name ?? "Store"} Credentials`;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          {step === 2 && (
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={handleBack}
              className="mb-1 self-start"
            >
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {step === 1
              ? "Choose the store you want to connect."
              : "Enter your login credentials for this store."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 px-4">
          {step === 1 && (
            <RetailerGrid
              onSelect={handleSelectRetailer}
              disabledIds={existingRetailerIds}
            />
          )}

          {step === 2 && (
            <div className="space-y-4">
              {isCustom && (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      Store Name
                    </label>
                    <Input
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="My Store"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      Store URL
                    </label>
                    <Input
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="https://www.example.com"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Username / Email
                </label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  autoComplete="current-password"
                />
              </div>

              <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3">
                <Shield className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Your credentials are encrypted at rest and only used to
                  authenticate automated purchases on your behalf.
                </p>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                className="w-full"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Credential"}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
