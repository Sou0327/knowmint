export class KmApiError extends Error {
  readonly status: number | null;
  readonly code: string | null;

  constructor(message: string, status: number | null = null, code: string | null = null) {
    super(message);
    this.name = "KmApiError";
    this.status = status;
    this.code = code;
  }
}
