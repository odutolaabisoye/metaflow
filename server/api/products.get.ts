const RANGE_PRESETS = new Set(["7d", "14d", "30d", "90d"]);
const SORT_FIELDS = new Set(["score", "roas", "ctr", "margin", "velocity", "spend", "revenue", "title"]);
const CATEGORY_VALUES = new Set(["SCALE", "TEST", "KILL", "RISK"]);

function isValidDate(value: string) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function normalizeDateRange(range?: string, start?: string, end?: string) {
  if (start && end) {
    if (!isValidDate(start) || !isValidDate(end)) {
      throw createError({ statusCode: 400, statusMessage: "Invalid start or end date" });
    }
    return { start, end, range: range ?? "custom" };
  }

  const safeRange = range && RANGE_PRESETS.has(range) ? range : "30d";
  const days = Number.parseInt(safeRange.replace("d", ""), 10);
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days + 1);

  return {
    range: safeRange,
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10)
  };
}

function normalizePagination(limit?: string) {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit ?? "20", 10) || 20, 1), 100);
  return { limit: safeLimit };
}

function normalizeSorting(sortBy?: string, sortDir?: string) {
  const field = sortBy && SORT_FIELDS.has(sortBy) ? sortBy : "score";
  const direction = sortDir === "asc" ? "asc" : "desc";
  return { field, direction };
}

function resolveCurrency(metaCurrency?: string, storeCurrency?: string) {
  if (metaCurrency) return { currency: metaCurrency, source: "meta_ads" } as const;
  if (storeCurrency) return { currency: storeCurrency, source: "store" } as const;
  return { currency: "USD", source: "default" } as const;
}

export default defineEventHandler((event) => {
  const query = getQuery(event);

  const { start, end, range } = normalizeDateRange(
    typeof query.range === "string" ? query.range : undefined,
    typeof query.start === "string" ? query.start : undefined,
    typeof query.end === "string" ? query.end : undefined
  );

  const { limit } = normalizePagination(typeof query.limit === "string" ? query.limit : undefined);

  const cursorId = typeof query.cursorId === "string" ? query.cursorId : undefined;

  const { field, direction } = normalizeSorting(
    typeof query.sortBy === "string" ? query.sortBy : undefined,
    typeof query.sortDir === "string" ? query.sortDir : undefined
  );

  const metaCurrency = typeof query.metaCurrency === "string" ? query.metaCurrency : undefined;
  const storeCurrency = typeof query.storeCurrency === "string" ? query.storeCurrency : undefined;
  const { currency, source: currencySource } = resolveCurrency(metaCurrency, storeCurrency);

  const q = typeof query.q === "string" ? query.q.trim().toLowerCase() : "";
  const category = typeof query.category === "string" && CATEGORY_VALUES.has(query.category) ? query.category : undefined;

  setHeader(event, "Cache-Control", "private, max-age=300");

  const products = [
    {
      id: "prod_1",
      title: "Aurora Throw Pillow",
      sku: "MF-1021",
      score: 91,
      roas: 8.4,
      blendedRoas: 6.9,
      ctr: 3.1,
      margin: 42,
      velocity: 6.2,
      category: "SCALE",
      spend: 1240,
      revenue: 10416,
      impressions: 84200,
      clicks: 2610,
      conversions: 312,
      conversionRate: 11.96,
      imageUrl: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=600&q=80",
      productUrl: "https://example.com/products/aurora-throw-pillow"
    },
    {
      id: "prod_2",
      title: "Sandstone Lamp",
      sku: "MF-1084",
      score: 77,
      roas: 5.1,
      blendedRoas: 4.3,
      ctr: 2.4,
      margin: 34,
      velocity: 3.4,
      category: "TEST",
      spend: 980,
      revenue: 4998,
      impressions: 52000,
      clicks: 1248,
      conversions: 97,
      conversionRate: 7.77,
      imageUrl: "https://images.unsplash.com/photo-1501045661006-fcebe0257c3f?auto=format&fit=crop&w=600&q=80",
      productUrl: "https://example.com/products/sandstone-lamp"
    },
    {
      id: "prod_3",
      title: "Classic Linen Sheet",
      sku: "MF-0951",
      score: 44,
      roas: 1.6,
      blendedRoas: 1.4,
      ctr: 1.1,
      margin: 18,
      velocity: 1.2,
      category: "KILL",
      spend: 740,
      revenue: 1184,
      impressions: 38400,
      clicks: 422,
      conversions: 21,
      conversionRate: 4.98,
      imageUrl: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=600&q=80",
      productUrl: "https://example.com/products/classic-linen-sheet"
    },
    {
      id: "prod_4",
      title: "Eclipse Wall Art",
      sku: "MF-1208",
      score: 69,
      roas: 4.3,
      blendedRoas: 3.8,
      ctr: 2.1,
      margin: 29,
      velocity: 2.7,
      category: "TEST",
      spend: 640,
      revenue: 2752,
      impressions: 41600,
      clicks: 874,
      conversions: 68,
      conversionRate: 7.78,
      imageUrl: "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=600&q=80",
      productUrl: "https://example.com/products/eclipse-wall-art"
    },
    {
      id: "prod_5",
      title: "Coastal Rug 5x8",
      sku: "MF-1114",
      score: 86,
      roas: 7.2,
      blendedRoas: 5.8,
      ctr: 2.8,
      margin: 38,
      velocity: 4.4,
      category: "SCALE",
      spend: 1560,
      revenue: 11232,
      impressions: 96400,
      clicks: 2699,
      conversions: 274,
      conversionRate: 10.15,
      imageUrl: "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=600&q=80",
      productUrl: "https://example.com/products/coastal-rug"
    },
    {
      id: "prod_6",
      title: "Sage Ceramic Set",
      sku: "MF-1177",
      score: 58,
      roas: 3.1,
      blendedRoas: 2.7,
      ctr: 1.7,
      margin: 22,
      velocity: 1.9,
      category: "RISK",
      spend: 520,
      revenue: 1612,
      impressions: 27800,
      clicks: 473,
      conversions: 34,
      conversionRate: 7.19,
      imageUrl: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=600&q=80",
      productUrl: "https://example.com/products/sage-ceramic-set"
    }
  ];

  const filtered = products.filter((product) => {
    const matchesQuery = q.length === 0 || product.title.toLowerCase().includes(q) || product.sku.toLowerCase().includes(q);
    const matchesCategory = !category || product.category === category;
    return matchesQuery && matchesCategory;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aValue = a[field as keyof typeof a];
    const bValue = b[field as keyof typeof b];

    if (typeof aValue === "string" && typeof bValue === "string") {
      return direction === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }

    const aNumber = typeof aValue === "number" ? aValue : 0;
    const bNumber = typeof bValue === "number" ? bValue : 0;
    return direction === "asc" ? aNumber - bNumber : bNumber - aNumber;
  });

  let startIndex = 0;
  if (cursorId) {
    const cursorIndex = sorted.findIndex((item) => item.id === cursorId);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  const paged = sorted.slice(startIndex, startIndex + limit);
  const lastItem = paged[paged.length - 1];
  const nextCursorId = startIndex + limit < sorted.length ? lastItem?.id ?? null : null;

  return {
    updatedAt: new Date().toISOString(),
    currency,
    currencySource,
    range,
    start,
    end,
    sortBy: field,
    sortDir: direction,
    limit,
    cursorId: cursorId ?? null,
    nextCursorId,
    total: sorted.length,
    products: paged
  };
});
