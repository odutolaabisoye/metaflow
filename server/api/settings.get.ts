export default defineEventHandler(() => {
  return {
    updatedAt: new Date().toISOString(),
    rules: {
      scale: true,
      test: true,
      kill: true,
      inventory: true
    },
    notifications: {
      emailReports: true,
      whatsappAlerts: true,
      weeklyDigest: false
    },
    billing: {
      plan: "Growth",
      price: "$149",
      nextInvoice: "March 12, 2026"
    }
  };
});
