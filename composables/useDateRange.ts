type DateRangeOption = {
  label: string;
  value: string;
  days: number;
};

const OPTIONS: DateRangeOption[] = [
  { label: "Last 7 days", value: "7d", days: 7 },
  { label: "Last 14 days", value: "14d", days: 14 },
  { label: "Last 30 days", value: "30d", days: 30 },
  { label: "Last 90 days", value: "90d", days: 90 }
];

export function useDateRange() {
  const selected = useState<string>("mf_date_range", () => "30d");

  if (process.client) {
    const stored = localStorage.getItem("mf_date_range");
    if (stored && OPTIONS.some((opt) => opt.value === stored)) {
      selected.value = stored;
    }

    watch(selected, (value) => {
      localStorage.setItem("mf_date_range", value);
    });
  }

  const option = computed(() => OPTIONS.find((opt) => opt.value === selected.value) ?? OPTIONS[2]);

  const endDate = computed(() => new Date());
  const startDate = computed(() => {
    const date = new Date();
    date.setDate(date.getDate() - option.value.days + 1);
    return date;
  });

  const start = computed(() => startDate.value.toISOString().slice(0, 10));
  const end = computed(() => endDate.value.toISOString().slice(0, 10));

  return {
    options: OPTIONS,
    selected,
    option,
    start,
    end
  };
}
