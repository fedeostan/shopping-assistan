"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCardIcon, StarIcon, Trash2Icon } from "lucide-react";

export interface PaymentMethod {
  id: string;
  label: string | null;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_active: boolean;
  is_default: boolean;
}

const BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  discover: "Discover",
  unknown: "Card",
};

export function PaymentCard({
  card,
  onSetDefault,
  onDelete,
}: {
  card: PaymentMethod;
  onSetDefault: (id: string) => void;
  onDelete: (card: PaymentMethod) => void;
}) {
  return (
    <Card className={card.is_default ? "border-primary" : ""}>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <CreditCardIcon className="size-6 text-muted-foreground" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {BRAND_LABELS[card.brand] ?? card.brand}
              </span>
              <span className="text-muted-foreground">
                &bull;&bull;&bull;&bull; {card.last4}
              </span>
              {card.is_default && (
                <Badge variant="default" className="text-xs">
                  Default
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {card.label && <span>{card.label} &middot; </span>}
              Exp {String(card.exp_month).padStart(2, "0")}/
              {String(card.exp_year).padStart(2, "0")}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!card.is_default && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSetDefault(card.id)}
            >
              <StarIcon className="size-4" />
              Set default
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(card)}
          >
            <Trash2Icon className="size-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
