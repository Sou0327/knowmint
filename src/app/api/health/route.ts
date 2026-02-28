import { apiSuccess } from "@/lib/api/response";

export async function GET() {
  return apiSuccess({
    status: "ok",
    service: "knowmint-api",
    timestamp: new Date().toISOString(),
  });
}
