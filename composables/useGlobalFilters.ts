import { useDateRange } from "~/composables/useDateRange";

export function useGlobalFilters() {
  const { selected, start, end, option, options } = useDateRange();

  const metaCurrency = useState<string>("mf_meta_currency", () => "USD");
  const storeCurrency = useState<string>("mf_store_currency", () => "NGN");

  const query = computed(() => ({
    range: selected.value,
    start: start.value,
    end: end.value,
    metaCurrency: metaCurrency.value,
    storeCurrency: storeCurrency.value
  }));

  return {
    selectedRange: selected,
    rangeOption: option,
    rangeOptions: options,
    start,
    end,
    metaCurrency,
    storeCurrency,
    query
  };
}
