"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusIcon } from "lucide-react";
import {
  luhnCheck,
  detectBrand,
  isExpiryValid,
  cvvLength,
} from "@/lib/crypto/card-validation";

export function AddCardForm({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cardNumber, setCardNumber] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [label, setLabel] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  function reset() {
    setCardNumber("");
    setCardholderName("");
    setExpMonth("");
    setExpYear("");
    setCvv("");
    setLabel("");
    setIsDefault(false);
    setError(null);
  }

  function formatCardNumber(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 19);
    // Group into 4s (amex: 4-6-5)
    return digits.replace(/(.{4})/g, "$1 ").trim();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const rawNumber = cardNumber.replace(/\s/g, "");
    if (!luhnCheck(rawNumber)) {
      setError("Invalid card number");
      return;
    }

    const month = parseInt(expMonth, 10);
    const year = parseInt(expYear, 10);
    if (!isExpiryValid(month, year)) {
      setError("Card is expired or invalid expiry");
      return;
    }

    const brand = detectBrand(rawNumber);
    const expectedCvvLen = cvvLength(brand);
    if (cvv.length !== expectedCvvLen) {
      setError(`CVV must be ${expectedCvvLen} digits`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardNumber: rawNumber,
          cvv,
          cardholderName,
          expMonth: month,
          expYear: year,
          label: label || undefined,
          isDefault,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to add card");
        return;
      }

      reset();
      setOpen(false);
      onSuccess();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <PlusIcon className="size-4" />
          Add card
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add payment method</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Card number</label>
            <Input
              placeholder="4242 4242 4242 4242"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              maxLength={23}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Cardholder name</label>
            <Input
              placeholder="John Doe"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              required
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-sm font-medium">Exp month</label>
              <Input
                placeholder="MM"
                value={expMonth}
                onChange={(e) =>
                  setExpMonth(e.target.value.replace(/\D/g, "").slice(0, 2))
                }
                maxLength={2}
                required
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-sm font-medium">Exp year</label>
              <Input
                placeholder="YY"
                value={expYear}
                onChange={(e) =>
                  setExpYear(e.target.value.replace(/\D/g, "").slice(0, 2))
                }
                maxLength={2}
                required
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-sm font-medium">CVV</label>
              <Input
                placeholder="123"
                type="password"
                value={cvv}
                onChange={(e) =>
                  setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                maxLength={4}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              Label <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              placeholder="Personal, Work..."
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="accent-primary"
            />
            Set as default payment method
          </label>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Adding..." : "Add card"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
