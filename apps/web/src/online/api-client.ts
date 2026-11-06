const REQUEST_TIMEOUT_MS = 8_000;

/** Fetches with same-origin credentials and a hard timeout. */
export async function request(fetcher: typeof fetch, url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetcher(url, { credentials: 'same-origin', ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
