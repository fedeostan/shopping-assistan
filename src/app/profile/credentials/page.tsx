"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CredentialCard,
  type CredentialItem,
} from "@/components/credentials/credential-card";
import { AddCredentialSheet } from "@/components/credentials/add-credential-sheet";

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const loadCredentials = useCallback(async () => {
    try {
      const res = await fetch("/api/credentials");
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setCredentials(json.data ?? []);
    } catch {
      // silently fail — empty list will show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  // Poll while any credential is in "pending" status (verification running in background)
  useEffect(() => {
    const hasPending = credentials.some((c) => c.status === "pending");
    if (!hasPending) return;

    const interval = setInterval(loadCredentials, 5_000);
    return () => clearInterval(interval);
  }, [credentials, loadCredentials]);

  async function handleRemove(id: string) {
    if (!confirm("Remove this store credential?")) return;
    setRemovingId(id);
    try {
      const res = await fetch(`/api/credentials/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCredentials((prev) => prev.filter((c) => c.id !== id));
      }
    } finally {
      setRemovingId(null);
    }
  }

  async function handleVerify(id: string) {
    setVerifyingId(id);
    // Optimistic: set status to pending
    setCredentials((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "pending" as const } : c))
    );
    try {
      const res = await fetch(`/api/credentials/${id}/verify`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setCredentials((prev) =>
          prev.map((c) =>
            c.id === id
              ? { ...c, status: data.status, verified_at: data.verified_at }
              : c
          )
        );
      }
    } finally {
      setVerifyingId(null);
    }
  }

  const existingRetailerIds = credentials.map((c) => c.retailer_id);

  return (
    <div className="h-svh overflow-y-auto bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-6 py-4">
          <Button asChild size="icon-sm" variant="ghost">
            <Link href="/profile">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Store Credentials</h1>
            <p className="text-sm text-muted-foreground">
              Manage your saved store accounts
            </p>
          </div>
          {credentials.length > 0 && (
            <Button size="sm" onClick={() => setSheetOpen(true)}>
              <Plus className="size-4" />
              Add
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">Loading credentials...</p>
          </div>
        ) : credentials.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-purple-500/10">
              <Store className="size-8 text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold">
              Connect your store accounts
            </h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Save your login credentials so the assistant can add items to your
              cart and complete purchases on your behalf.
            </p>
            <Button className="mt-6" onClick={() => setSheetOpen(true)}>
              <Plus className="size-4" />
              Add Credential
            </Button>
          </div>
        ) : (
          /* List state */
          <div className="flex flex-col gap-3">
            {credentials.map((cred) => (
              <CredentialCard
                key={cred.id}
                credential={cred}
                onRemove={handleRemove}
                onVerify={handleVerify}
                removing={removingId === cred.id}
                verifying={verifyingId === cred.id}
              />
            ))}
          </div>
        )}
      </main>

      <AddCredentialSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        existingRetailerIds={existingRetailerIds}
        onSaved={loadCredentials}
      />
    </div>
  );
}
