/** Browser helper for calling our route handlers. */

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function postJSON<T = unknown>(url: string, body?: unknown, init?: { signal?: AbortSignal }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? "{}" : JSON.stringify(body),
      signal: init?.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError("Ingen anslutning. Kontrollera internet och försök igen.", "network", true, 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      data?.error ?? "Något gick fel. Försök igen.",
      data?.code ?? "unknown",
      data?.retryable ?? res.status >= 500,
      res.status,
    );
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Något gick fel.";
}
