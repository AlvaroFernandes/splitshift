export const runtime = "edge";

export function GET() {
  return Response.json({ status: "ok", ts: Date.now() });
}
