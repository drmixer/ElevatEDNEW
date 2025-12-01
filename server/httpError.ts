export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = 'bad_request', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
