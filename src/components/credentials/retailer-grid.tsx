"use client";

import { Store, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PREDEFINED_RETAILERS } from "@/lib/connectors/retailers";

interface RetailerGridProps {
  onSelect: (retailerId: string) => void;
  disabledIds: string[];
}

export function RetailerGrid({ onSelect, disabledIds }: RetailerGridProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {PREDEFINED_RETAILERS.map((retailer) => {
          const isDisabled = disabledIds.includes(retailer.id);
          return (
            <Button
              key={retailer.id}
              variant="outline"
              className="flex h-auto flex-col gap-2 py-4 disabled:opacity-40"
              disabled={isDisabled}
              onClick={() => onSelect(retailer.id)}
            >
              <Store className="size-5 text-purple-400" />
              <span className="text-xs">{retailer.name}</span>
            </Button>
          );
        })}
      </div>

      <Button
        variant="outline"
        className="w-full border-dashed"
        onClick={() => onSelect("custom")}
      >
        <Plus className="size-4" />
        Custom Store
      </Button>
    </div>
  );
}
