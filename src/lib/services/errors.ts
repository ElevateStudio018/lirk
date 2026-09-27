export class ServiceError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string = "error",
    public retryable = false,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export const notFound = (what = "Det du letar efter") => new ServiceError(404, `${what} finns inte.`, "not_found");
export const conflict = (message: string) => new ServiceError(409, message, "conflict");
export const badRequest = (message: string) => new ServiceError(400, message, "bad_request");

/** Throws a ServiceError for a failed Supabase query. */
export function dbError(error: { message: string; code?: string } | null, context: string): never {
  console.error(`[db] ${context}:`, error?.message);
  throw new ServiceError(500, "Något gick fel när data skulle sparas eller hämtas. Försök igen.", "db_error", true);
}

/** Unwraps a Supabase response, throwing on error or missing data. */
export function must<T>(res: { data: T | null; error: { message: string } | null }, context: string): T {
  if (res.error) dbError(res.error, context);
  if (res.data === null) throw notFound();
  return res.data;
}
