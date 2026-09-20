import { handleMissionAction } from "@/app/api/outcomes/route";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return handleMissionAction(id, "get", _request);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "step";
  return handleMissionAction(id, action, request);
}
