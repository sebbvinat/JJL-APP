export class FetchError extends Error {
  status: number;
  info: unknown;
  constructor(status: number, info: unknown, message: string) {
    super(message);
    this.status = status;
    this.info = info;
  }
}

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let info: unknown = null;
    try {
      info = await res.json();
    } catch {
      info = await res.text().catch(() => null);
    }
    throw new FetchError(res.status, info, `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}
