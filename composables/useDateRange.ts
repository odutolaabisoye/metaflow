type DateRangeOption = {
  label: string;
  value: string;
};

const OPTIONS: DateRangeOption[] = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
  { label: "This month", value: "this_month" },
  { label: "Last month", value: "last_month" },
  { label: "This quarter", value: "this_quarter" },
  { label: "Last quarter", value: "last_quarter" },
  { label: "This year", value: "this_year" },
  { label: "Last year", value: "last_year" },
  { label: "Custom range", value: "custom" }
];

// Use local date parts — NOT toISOString() which returns UTC.
// Without this, a user in Nigeria (UTC+1) at 11pm would get yesterday's UTC date.
function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isValidDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfQuarter(date: Date) {
  const q = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), q * 3, 1);
}

function endOfQuarter(date: Date) {
  const q = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), q * 3 + 3, 0);
}

function computePresetRange(value: string, now: Date) {
  const end = new Date(now);
  switch (value) {
    case "today": {
      return { start: new Date(end), end };
    }
    case "yesterday": {
      const d = new Date(end);
      d.setDate(d.getDate() - 1);
      return { start: d, end: d };
    }
    case "7d":
    case "30d":
    case "90d": {
      const days = value === "7d" ? 7 : value === "30d" ? 30 : 90;
      const start = new Date(end);
      start.setDate(start.getDate() - days + 1);
      return { start, end };
    }
    case "this_month": {
      return { start: startOfMonth(end), end };
    }
    case "last_month": {
      const lastMonth = new Date(end.getFullYear(), end.getMonth() - 1, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    }
    case "this_quarter": {
      return { start: startOfQuarter(end), end };
    }
    case "last_quarter": {
      const lastQ = new Date(end.getFullYear(), end.getMonth() - 3, 1);
      return { start: startOfQuarter(lastQ), end: endOfQuarter(lastQ) };
    }
    case "this_year": {
      return { start: new Date(end.getFullYear(), 0, 1), end };
    }
    case "last_year": {
      const y = end.getFullYear() - 1;
      return { start: new Date(y, 0, 1), end: new Date(y, 11, 31) };
    }
    default:
      return { start: new Date(end), end };
  }
}

export function useDateRange() {
  const selected = useState<string>("mf_date_range", () => "30d");
  const customStart = useState<string | null>("mf_date_range_start", () => null);
  const customEnd = useState<string | null>("mf_date_range_end", () => null);

  if (process.client) {
    const stored = localStorage.getItem("mf_date_range");
    if (stored && OPTIONS.some((opt) => opt.value === stored)) {
      selected.value = stored;
    }

    watch(selected, (value) => {
      localStorage.setItem("mf_date_range", value);
    });

    const storedStart = localStorage.getItem("mf_date_range_start");
    const storedEnd = localStorage.getItem("mf_date_range_end");
    if (storedStart && isValidDateString(storedStart)) customStart.value = storedStart;
    if (storedEnd && isValidDateString(storedEnd)) customEnd.value = storedEnd;

    watch(customStart, (value) => {
      if (value) localStorage.setItem("mf_date_range_start", value);
    });
    watch(customEnd, (value) => {
      if (value) localStorage.setItem("mf_date_range_end", value);
    });
  }

  const option = computed(() => OPTIONS.find((opt) => opt.value === selected.value) ?? OPTIONS[3]);

  const isCustom = computed(() => selected.value === "custom");

  const endDate = computed(() => new Date());
  const startDate = computed(() => {
    if (isCustom.value) {
      const fallback = computePresetRange("7d", endDate.value);
      const startValue = customStart.value && isValidDateString(customStart.value)
        ? new Date(customStart.value)
        : fallback.start;
      return startValue;
    }
    return computePresetRange(option.value.value, endDate.value).start;
  });

  const end = computed(() => {
    if (isCustom.value) {
      const fallback = computePresetRange("7d", endDate.value);
      const endValue = customEnd.value && isValidDateString(customEnd.value)
        ? new Date(customEnd.value)
        : fallback.end;
      return toISODate(endValue);
    }
    return toISODate(computePresetRange(option.value.value, endDate.value).end);
  });

  const start = computed(() => toISODate(startDate.value));

  watch(selected, (value) => {
    if (value !== "custom") return;
    const fallback = computePresetRange("7d", new Date());
    if (!customStart.value) customStart.value = toISODate(fallback.start);
    if (!customEnd.value) customEnd.value = toISODate(fallback.end);
  });

  watch([start, end], ([s, e]) => {
    if (!isCustom.value) return;
    if (s && e && s > e) {
      customEnd.value = s;
    }
  });

  return {
    options: OPTIONS,
    selected,
    option,
    start,
    end,
    customStart,
    customEnd,
    isCustom
  };
}
