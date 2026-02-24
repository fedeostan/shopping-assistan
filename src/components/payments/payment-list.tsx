"use client";

import { PaymentCard, type PaymentMethod } from "./payment-card";
import { CreditCardIcon } from "lucide-react";

export function PaymentList({
  cards,
  onSetDefault,
  onDelete,
}: {
  cards: PaymentMethod[];
  onSetDefault: (id: string) => void;
  onDelete: (card: PaymentMethod) => void;
}) {
  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
        <CreditCardIcon className="size-10" />
        <p className="text-sm">No payment methods yet.</p>
        <p className="text-xs">Add a card to enable one-click purchases.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {cards.map((card) => (
        <PaymentCard
          key={card.id}
          card={card}
          onSetDefault={onSetDefault}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
