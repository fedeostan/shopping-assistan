import type { MarketplaceConnector } from "./types";

const connectors: MarketplaceConnector[] = [];

export function registerConnector(connector: MarketplaceConnector): void {
  if (!connector.enabled) {
    console.log(`[Connectors] Skipping disabled connector: ${connector.id}`);
    return;
  }
  connectors.push(connector);
  console.log(`[Connectors] Registered: ${connector.id} (${connector.supportedCountries.join(",")})`);
}

/** All enabled connectors */
export function getEnabledConnectors(): MarketplaceConnector[] {
  return connectors;
}

/** Connectors that serve a given country */
export function getConnectorsForCountry(country: string): MarketplaceConnector[] {
  return connectors.filter((c) => c.supportedCountries.includes(country));
}

/** Find the connector that owns a URL (for purchase routing) */
export function findConnectorForUrl(url: string): MarketplaceConnector | undefined {
  return connectors.find((c) => c.ownsUrl(url));
}

/** Hostnames covered by enabled connectors (to skip redundant SerpAPI site: searches) */
export function getCoveredHostnames(): Set<string> {
  return new Set(connectors.flatMap((c) => c.coveredHostnames));
}
