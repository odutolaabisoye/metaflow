export default defineEventHandler(() => {
  return {
    updatedAt: new Date().toISOString(),
    events: [
      {
        id: 1,
        title: "Moved 12 products to SCALE set",
        detail: "Triggered by score >= 80",
        tag: "Scale",
        variant: "secondary",
        time: "Today, 08:42",
        meta: "Ad Set: SCALE | Avg ROAS: 6.9x | CTR: 2.7%"
      },
      {
        id: 2,
        title: "Suppressed 18 low-margin SKUs",
        detail: "Margin below 20% threshold",
        tag: "Kill",
        variant: "destructive",
        time: "Yesterday, 18:05",
        meta: "Ad Set: KILL | Avg margin: 14% | ROAS: 1.3x"
      },
      {
        id: 3,
        title: "Inventory risk alert sent",
        detail: "Stock below 12 units",
        tag: "Risk",
        variant: "outline",
        time: "Yesterday, 12:10",
        meta: "Products: 9 | Avg velocity: 3.2/day"
      }
    ]
  };
});
