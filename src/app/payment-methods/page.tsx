"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { PaymentList } from "@/components/payments/payment-list";
import { AddCardForm } from "@/components/payments/add-card-form";
import { DeleteConfirm } from "@/components/payments/delete-confirm";
import type { PaymentMethod } from "@/components/payments/payment-card";

export default function PaymentMethodsPage() {
  const [cards, setCards] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<PaymentMethod | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCards = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/payment-methods");
      if (!res.ok) throw new Error("Failed to load cards");
      const data = await res.json();
      setCards(data.data);
    } catch {
      setError("Could not load payment methods.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  async function handleSetDefault(id: string) {
    await fetch(`/api/payment-methods/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    fetchCards();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/payment-methods/${deleteTarget.id}`, {
      method: "DELETE",
    });
    setDeleteTarget(null);
    setDeleting(false);
    fetchCards();
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link href="/">
                <Button variant="ghost" size="icon-sm">
                  <ArrowLeftIcon className="size-4" />
                </Button>
              </Link>
              <CardTitle className="text-xl">Payment Methods</CardTitle>
            </div>
            <AddCardForm onSuccess={fetchCards} />
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Loading...
            </p>
          ) : error ? (
            <p className="text-center text-sm text-destructive py-8">
              {error}
            </p>
          ) : (
            <PaymentList
              cards={cards}
              onSetDefault={handleSetDefault}
              onDelete={setDeleteTarget}
            />
          )}
        </CardContent>
      </Card>

      <DeleteConfirm
        last4={deleteTarget?.last4 ?? ""}
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
