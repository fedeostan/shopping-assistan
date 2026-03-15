import type { Locale } from "./detect";

interface LocaleMessages {
  welcome: {
    title: string;
    subtitle: string;
  };
  suggestions: { label: string; prompt: string }[];
  composer: {
    placeholder: string;
  };
}

export const messages: Record<Locale, LocaleMessages> = {
  en: {
    welcome: {
      title: "Shopping Assistant",
      subtitle: "Find deals, compare prices, and buy — all from chat.",
    },
    suggestions: [
      { label: "Search deals", prompt: "Find me the best wireless earbuds under $100" },
      { label: "Compare prices", prompt: "Compare prices for a Nintendo Switch across stores" },
      { label: "Track a price", prompt: "Track the price of the MacBook Air M4" },
      { label: "Get recommendations", prompt: "What products do you recommend based on my preferences?" },
    ],
    composer: { placeholder: "Send a message..." },
  },
  es: {
    welcome: {
      title: "Asistente de Compras",
      subtitle: "Encuentra ofertas, compara precios y compra — todo desde el chat.",
    },
    suggestions: [
      { label: "Buscar ofertas", prompt: "Busco los mejores auriculares inalámbricos por menos de $2000 MXN" },
      { label: "Comparar precios", prompt: "Compara precios del Nintendo Switch en diferentes tiendas" },
      { label: "Seguir un precio", prompt: "Quiero seguir el precio del MacBook Air M4" },
      { label: "Recomendaciones", prompt: "¿Qué productos me recomiendas según mis preferencias?" },
    ],
    composer: { placeholder: "Escribe un mensaje..." },
  },
  pt: {
    welcome: {
      title: "Assistente de Compras",
      subtitle: "Encontre ofertas, compare preços e compre — tudo pelo chat.",
    },
    suggestions: [
      { label: "Buscar ofertas", prompt: "Procuro os melhores fones de ouvido sem fio por menos de R$500" },
      { label: "Comparar preços", prompt: "Compare preços do Nintendo Switch em diferentes lojas" },
      { label: "Acompanhar preço", prompt: "Quero acompanhar o preço do MacBook Air M4" },
      { label: "Recomendações", prompt: "Quais produtos você recomenda com base nas minhas preferências?" },
    ],
    composer: { placeholder: "Escreva uma mensagem..." },
  },
};
