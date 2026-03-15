export type Locale = "en" | "es" | "pt";

const SPANISH_STOPWORDS = new Set([
  "busco", "quiero", "precio", "comprar", "barato", "oferta", "necesito",
  "tienda", "envío", "caro", "mejor", "producto", "comparar", "recomendar",
  "también", "para", "pero", "como", "donde", "cuando", "porque", "esta",
  "este", "esto", "esas", "esos", "tiene", "están", "puedo", "puede",
]);

const PORTUGUESE_STOPWORDS = new Set([
  "procuro", "quero", "preço", "comprar", "barato", "oferta", "preciso",
  "loja", "envio", "caro", "melhor", "produto", "comparar", "recomendar",
  "também", "para", "mas", "como", "onde", "quando", "porque", "esta",
  "este", "isso", "essas", "esses", "tem", "estão", "posso", "pode",
]);

/**
 * Detect language from text using word-frequency heuristic.
 * Score >= 2 stop-word matches wins; defaults to "en".
 */
export function detectLanguage(text: string): Locale {
  const words = text.toLowerCase().split(/\s+/);

  let esScore = 0;
  let ptScore = 0;

  for (const word of words) {
    // Strip common punctuation for matching
    const clean = word.replace(/[.,!?¿¡;:()]/g, "");
    if (SPANISH_STOPWORDS.has(clean)) esScore++;
    if (PORTUGUESE_STOPWORDS.has(clean)) ptScore++;
  }

  if (esScore >= 2 && esScore > ptScore) return "es";
  if (ptScore >= 2 && ptScore > esScore) return "pt";

  // Disambiguate ties: check for language-unique characters/patterns
  if (esScore >= 2 && esScore === ptScore) {
    // ñ is uniquely Spanish; ç, ã, õ are uniquely Portuguese
    if (/ñ/.test(text)) return "es";
    if (/[çãõ]/.test(text)) return "pt";
    return "es"; // default tie-break to Spanish
  }

  return "en";
}

export const LOCALE_CONFIG = {
  es: { country: "MX", currency: "MXN", gl: "mx", label: "Spanish" },
  pt: { country: "BR", currency: "BRL", gl: "br", label: "Portuguese" },
  en: { country: "US", currency: "USD", gl: "us", label: "English" },
} as const;
