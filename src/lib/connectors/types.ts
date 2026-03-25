/** Result from a marketplace cart/checkout adapter */
export type CartResult =
  | {
      success: true;
      checkoutUrl: string;
      method: string;
      metadata?: Record<string, unknown>;
    }
  | { success: false; reason: string; message: string };

/** Marketplace connector — provides cart URL building and URL ownership detection */
export interface MarketplaceConnector {
  readonly id: string;
  readonly displayName: string;
  readonly enabled: boolean;
  readonly coveredHostnames: string[];
  readonly supportedCountries: string[];

  /** Build a cart/checkout URL for a product on this marketplace. Returns null if URL doesn't match. */
  tryCart?(productUrl: string, quantity: number): Promise<CartResult | null>;

  /** Check if a product URL belongs to this marketplace */
  ownsUrl(url: string): boolean;
}
