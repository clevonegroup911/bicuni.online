import { NextResponse } from "next/server";
import { readinessReport } from "@/lib/health/checks";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export function liveResponse() {
  return NextResponse.json(
    { status: "ok", check: "live" },
    { status: 200, headers: NO_STORE },
  );
}

export async function readyResponse() {
  const report = await readinessReport();
  return NextResponse.json(
    {
      status: report.ready ? "ok" : "unavailable",
      check: "ready",
      dependencies: report.dependencies,
    },
    {
      status: report.ready ? 200 : 503,
      headers: NO_STORE,
    },
  );
}
