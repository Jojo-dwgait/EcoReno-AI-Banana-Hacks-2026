export type ErrorCode =
  | "BAD_REQUEST"
  | "GEOCODE_NO_MATCH"
  | "GEOCODE_UNAVAILABLE"
  | "CLIMATE_UNAVAILABLE"
  | "CLIMATE_PARTIAL"
  | "NOT_A_HOUSE"
  | "ANALYSIS_FAILED"
  | "EDIT_QUOTA"
  | "EDIT_FAILED"
  | "REVIEW_FAILED"
  | "RATE_LIMITED"
  | "VALUE_UNAVAILABLE";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status = 500,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export type ApiError = { ok: false; code: ErrorCode; message: string };

export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json({ ok: false, code: err.code, message: err.message } satisfies ApiError, {
      status: err.status,
    });
  }
  console.error(JSON.stringify({ level: "error", msg: "unhandled", error: String(err) }));
  return Response.json(
    { ok: false, code: "BAD_REQUEST", message: "Something went wrong. Please try again." } satisfies ApiError,
    { status: 500 },
  );
}
