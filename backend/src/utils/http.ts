type RetryOptions = {
  retries?: number;
  timeoutMs?: number;
  retryOnStatuses?: number[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const asInt = parseInt(headerValue, 10);
  if (!Number.isNaN(asInt)) return asInt * 1000;
  const date = Date.parse(headerValue);
  if (!Number.isNaN(date)) {
    const diff = date - Date.now();
    return diff > 0 ? diff : 0;
  }
  return null;
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: RetryOptions = {}
): Promise<Response> {
  const retries = opts.retries ?? 3;
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const retryOnStatuses = opts.retryOnStatuses ?? [408, 409, 425, 429, 500, 502, 503, 504];

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(id);

      if (!retryOnStatuses.includes(res.status)) {
        return res;
      }

      // Retry-After header (seconds or HTTP date)
      const retryAfter = parseRetryAfterMs(res.headers.get("retry-after"));
      const backoff = retryAfter ?? (500 * Math.pow(2, attempt) + Math.floor(Math.random() * 200));
      await sleep(backoff);
      attempt += 1;
      continue;
    } catch (err) {
      clearTimeout(id);
      lastError = err;
      const backoff = 500 * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
      await sleep(backoff);
      attempt += 1;
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("fetchWithRetry failed");
}
