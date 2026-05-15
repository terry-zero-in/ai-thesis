// Shared bearer-token check for cron-invoked edge functions.
// Edge function endpoints are public; we require the caller to present the
// CRON_INVOKE_SECRET so random internet traffic can't trigger ingestion.

import { requireEnv } from "./env.ts";

export function requireCronAuth(req: Request): void {
  const expected = requireEnv("CRON_INVOKE_SECRET");
  const header = req.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match || match[1] !== expected) {
    throw new HttpError(401, "unauthorized");
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
