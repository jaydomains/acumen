/**
 * Backend error envelope (AC-CD6).
 *
 * Every non-2xx JSON response follows the shape:
 *   { error: { code: string, message: string, detail: unknown | null } }
 *
 * `ApiError` surfaces all three fields plus the HTTP status so callers
 * can branch on either the structured code (preferred) or the status.
 */

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    detail: unknown;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: unknown;

  constructor(status: number, code: string, message: string, detail: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

const isErrorBody = (value: unknown): value is ApiErrorBody => {
  if (typeof value !== "object" || value === null) return false;
  const maybe = (value as { error?: unknown }).error;
  if (typeof maybe !== "object" || maybe === null) return false;
  const e = maybe as { code?: unknown; message?: unknown };
  return typeof e.code === "string" && typeof e.message === "string";
};

export const apiErrorFromBody = (
  status: number,
  statusText: string,
  body: unknown,
): ApiError => {
  if (isErrorBody(body)) {
    return new ApiError(status, body.error.code, body.error.message, body.error.detail);
  }
  return new ApiError(status, "unknown", `HTTP ${status} ${statusText}`, body);
};

export const parseError = async (resp: Response): Promise<ApiError> => {
  let body: unknown = null;
  try {
    body = await resp.json();
  } catch {
    /* no body or non-JSON; fall through */
  }
  return apiErrorFromBody(resp.status, resp.statusText, body);
};
