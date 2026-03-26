"use client";

import { Store, CheckCircle, XCircle, Loader, RefreshCw, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface CredentialItem {
  id: string;
  retailer_id: string;
  retailer_name: string;
  retailer_url: string;
  retailer_icon: string;
  username: string;
  status: "pending" | "verified" | "failed";
  verified_at: string | null;
  created_at: string;
}

interface CredentialCardProps {
  credential: CredentialItem;
  onRemove: (id: string) => void;
  onVerify: (id: string) => void;
  removing: boolean;
  verifying: boolean;
}

const statusConfig = {
  pending: {
    label: "Verifying",
    variant: "outline" as const,
    className: "border-yellow-500/50 text-yellow-500",
    icon: <Loader className="size-3 animate-spin" />,
  },
  verified: {
    label: "Verified",
    variant: "outline" as const,
    className: "border-green-500/50 text-green-500",
    icon: <CheckCircle className="size-3" />,
  },
  failed: {
    label: "Failed",
    variant: "outline" as const,
    className: "border-red-500/50 text-red-500",
    icon: <XCircle className="size-3" />,
  },
};

export function CredentialCard({
  credential,
  onRemove,
  onVerify,
  removing,
  verifying,
}: CredentialCardProps) {
  const status = statusConfig[credential.status];

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        {/* Store icon */}
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-purple-500/10">
          <Store className="size-5 text-purple-400" />
        </div>

        {/* Name + username */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{credential.retailer_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {credential.username}
          </p>
        </div>

        {/* Status badge */}
        <Badge variant={status.variant} className={status.className}>
          {status.icon}
          <span className="ml-1">{status.label}</span>
        </Badge>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {credential.status === "failed" && (
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => onVerify(credential.id)}
              disabled={verifying}
              title="Retry verification"
            >
              <RefreshCw className={`size-3 ${verifying ? "animate-spin" : ""}`} />
            </Button>
          )}
          <Button
            size="icon-xs"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => onRemove(credential.id)}
            disabled={removing}
            title="Remove credential"
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
