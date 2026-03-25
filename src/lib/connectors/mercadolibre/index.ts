import { registerConnector } from "../registry";
import type { MarketplaceConnector } from "../types";
import { ownsMeliUrl, tryMeliCart } from "./cart";

const mercadolibre: MarketplaceConnector = {
  id: "mercadolibre",
  displayName: "Mercado Libre",
  enabled: true,
  coveredHostnames: [], // MeLi isn't in RETAILER_SITES, nothing to skip
  supportedCountries: ["AR", "BR", "MX", "CL", "CO"],

  tryCart: tryMeliCart,
  ownsUrl: ownsMeliUrl,
};

registerConnector(mercadolibre);
