import { readyResponse } from "@/lib/health/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return readyResponse();
}
