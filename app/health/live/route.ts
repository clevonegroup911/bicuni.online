import { liveResponse } from "@/lib/health/http";

export const dynamic = "force-dynamic";

export function GET() {
  return liveResponse();
}
