import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { apiError, getAuthenticatedUser, isServerConfigured } from "@/lib/server-neon";

export async function POST(request: Request) {
  if (!isServerConfigured()) return apiError("Server configuration is incomplete. Check the README environment setup.", 503);
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Session expired. Please try again.", 401);
  let body: { memberId?: string; ghat?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("Missing report details could not be read.");
  }
  if (!body.memberId || !body.ghat?.trim() || body.ghat.trim().length > 100) {
    return apiError("Select a family member and a valid ghat where they were last seen.");
  }
  const ghat = body.ghat.trim();

  try {
    const outcome = await withTransaction(async (client) => {
      const { rows: [member] } = await client.query<{ id: string; status: string }>(
        `select id, status from public.members
         where id = $1 and owner_id = $2 for update`,
        [body.memberId, user.id],
      );
      if (!member) return { error: "This member is not in your family.", status: 404 };
      if (member.status === "missing") return { error: "This member is already reported missing.", status: 409 };

      await client.query(
        "update public.members set status = 'missing' where id = $1 and owner_id = $2",
        [member.id, user.id],
      );
      await client.query(
        "insert into public.missing_logs (member_id, owner_id, ghat) values ($1, $2, $3)",
        [member.id, user.id, ghat],
      );
      return null;
    });
    if (outcome) return apiError(outcome.error, outcome.status);
    return NextResponse.json({ status: "missing" }, { status: 201 });
  } catch (error) {
    console.error("Missing report database operation failed.", error);
    return apiError("Could not report this member missing. Please try again.", 500);
  }
}
