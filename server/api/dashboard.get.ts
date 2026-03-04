function resolveCurrency(metaCurrency?: string, storeCurrency?: string) {
  if (metaCurrency) return { currency: metaCurrency, source: "meta_ads" } as const;
  if (storeCurrency) return { currency: storeCurrency, source: "store" } as const;
  return { currency: "USD", source: "default" } as const;
}

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const metaCurrency = typeof query.metaCurrency === "string" ? query.metaCurrency : undefined;
  const storeCurrency = typeof query.storeCurrency === "string" ? query.storeCurrency : undefined;
  const { currency, source: currencySource } = resolveCurrency(metaCurrency, storeCurrency);

  return {
    updatedAt: new Date().toISOString(),
    currency,
    currencySource,
    stats: {
      roas: { value: "5.8x", delta: "Up 12% vs prior period" },
      activeProducts: { value: "1,284", detail: "89 winners, 340 tests" },
      inventoryRisk: { value: "46", detail: "Needs reorder in 9 days" }
    },
    attribution: {
      topCategory: "Home Decor",
      avgCtr: "2.4%",
      conversionRate: "3.1%"
    },
    aiGuidance: [
      {
        id: "ai_1",
        title: "Boost SKUs with ROAS > 8x",
        detail: "Create a dedicated ad set for 12 high performers.",
        tag: "Scale",
        variant: "secondary"
      },
      {
        id: "ai_2",
        title: "Suppress low-margin apparel",
        detail: "Margin below 18% is dragging catalog ROAS.",
        tag: "Kill",
        variant: "destructive"
      },
      {
        id: "ai_3",
        title: "Reorder inventory for 9 items",
        detail: "Inventory risk products are trending +32% CTR.",
        tag: "Inventory",
        variant: "outline"
      }
    ],
    automation: {
      liveRules: [
        { label: "Score-based labels", status: "Live", variant: "secondary" },
        { label: "Inventory risk throttle", status: "Live", variant: "default" },
        { label: "Low-margin suppression", status: "Paused", variant: "destructive" }
      ],
      recentActivity: [
        { title: "12 products moved to SCALE", detail: "ROAS above 6x, CTR 2.9%", time: "2h ago" },
        { title: "Inventory risk alert sent", detail: "9 SKUs below 15 units", time: "5h ago" },
        { title: "Test budget raised 12%", detail: "Triggered by ROAS lift", time: "Yesterday" }
      ]
    }
  };
});
