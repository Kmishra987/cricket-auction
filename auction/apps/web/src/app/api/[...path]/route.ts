import { route, json } from "../../../../../server/src/routes";

// The whole auction API runs inside Next so it can be hosted on Vercel.
// Same origin, so no CORS headers and the session cookie just works.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  const response = await route(request, { headers: {} });
  return response ?? json({ error: { code: "NOT_FOUND", message: "Route not found." } }, 404);
}

export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
