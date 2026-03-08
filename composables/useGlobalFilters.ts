import { useDateRange } from "~/composables/useDateRange";

export function useGlobalFilters() {
  const { selected, start, end, option, options, customStart, customEnd, isCustom } = useDateRange();

  const metaCurrency = useState<string | null>("mf_meta_currency", () => null);
  const storeCurrency = useState<string | null>("mf_store_currency", () => null);

  // Shared active store ID — set by the sidebar store switcher.
  // All page API calls automatically include it so the backend filters to
  // the correct business. Falls back to the user's first store when null.
  const activeStoreId = useState<string | null>("mf_active_store_id", () => null);

  const query = computed(() => ({
    range: selected.value,
    start: start.value,
    end: end.value,
    ...(activeStoreId.value ? { storeId: activeStoreId.value } : {}),
    ...(metaCurrency.value ? { metaCurrency: metaCurrency.value } : {}),
    ...(storeCurrency.value ? { storeCurrency: storeCurrency.value } : {}),
  }));

  return {
    selectedRange: selected,
    rangeOption: option,
    rangeOptions: options,
    start,
    end,
    customStart,
    customEnd,
    isCustom,
    metaCurrency,
    storeCurrency,
    activeStoreId,
    query
  };
}
