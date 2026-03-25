// Side-effect imports — each module calls registerConnector() on load
import "./mercadolibre";

export { findConnectorForUrl } from "./registry";
export type { MarketplaceConnector, CartResult } from "./types";
