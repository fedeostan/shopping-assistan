export interface RetailerDef {
  id: string;
  name: string;
  icon: string;
  url: string;
  loginUrl: string;
}

export const PREDEFINED_RETAILERS: RetailerDef[] = [
  { id: "amazon",       name: "Amazon",       icon: "amazon",       url: "https://www.amazon.com",       loginUrl: "https://www.amazon.com/ap/signin" },
  { id: "mercadolibre", name: "MercadoLibre", icon: "mercadolibre", url: "https://www.mercadolibre.com", loginUrl: "https://www.mercadolibre.com/jms/login" },
  { id: "ebay",         name: "eBay",         icon: "ebay",         url: "https://www.ebay.com",         loginUrl: "https://signin.ebay.com" },
  { id: "walmart",      name: "Walmart",      icon: "walmart",      url: "https://www.walmart.com",      loginUrl: "https://www.walmart.com/account/login" },
  { id: "bestbuy",      name: "Best Buy",     icon: "bestbuy",      url: "https://www.bestbuy.com",      loginUrl: "https://www.bestbuy.com/identity/signin" },
  { id: "target",       name: "Target",       icon: "target",       url: "https://www.target.com",       loginUrl: "https://www.target.com/account" },
  { id: "alibaba",      name: "Alibaba",      icon: "alibaba",      url: "https://www.alibaba.com",      loginUrl: "https://login.alibaba.com" },
  { id: "shein",        name: "Shein",        icon: "shein",        url: "https://www.shein.com",        loginUrl: "https://www.shein.com/user/auth/login" },
  { id: "temu",         name: "Temu",         icon: "temu",         url: "https://www.temu.com",         loginUrl: "https://www.temu.com/login.html" },
];

export function getRetailerById(id: string): RetailerDef | undefined {
  return PREDEFINED_RETAILERS.find((r) => r.id === id);
}

export const RETAILER_CATEGORIES: Record<string, string[]> = {
  amazon:       ["electronics", "books", "home", "general"],
  mercadolibre: ["electronics", "home", "automotive", "general"],
  ebay:         ["collectibles", "electronics", "automotive", "used"],
  walmart:      ["groceries", "home", "electronics", "general"],
  bestbuy:      ["electronics", "computers", "gaming", "appliances"],
  target:       ["home", "clothing", "beauty", "baby"],
  alibaba:      ["wholesale", "manufacturing", "electronics"],
  shein:        ["clothing", "fashion", "accessories"],
  temu:         ["clothing", "home", "electronics", "budget"],
};
