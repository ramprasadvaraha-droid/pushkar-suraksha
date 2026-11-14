import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { apiError, getAuthenticatedUser, isServerConfigured } from "@/lib/server-neon";
import { getApprovedVolunteer } from "@/lib/volunteer-access";

export async function POST(request: Request) {
  if (!isServerConfigured()) return apiError("Server configuration is incomplete. Check the README environment setup.", 503);
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Session expired. Please sign in again.", 401);
  const volunteer = await getApprovedVolunteer(user.id);
  if (!volunteer) return apiError("Organizer approval is required before using the volunteer desk.", 403);

  let body: { memberId?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("Handover confirmation could not be read.");
  }
  if (!body.memberId || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(body.memberId)) {
    return apiError("Choose a valid missing member.");
  }
  const memberId = body.memberId;

  try {
    const result = await withTransaction(async (client) => {
      const { rows: [member] } = await client.query<{
        missing_log_id: string;
        ghat: string;
      }>(
        `select ml.id as missing_log_id, hv.ghat
         from public.members m
         join public.missing_logs ml on ml.member_id = m.id and ml.found_at is null
         join public.volunteer_handover_verifications hv
           on hv.missing_log_id = ml.id
          and hv.volunteer_id = $2
          and hv.verified_at > now() - interval '15 minutes'
         where m.id = $1 and m.status = 'missing'
         for update of m, ml, hv`,
        [memberId, volunteer.id],
      );
      if (!member) {
        return {
          error: "Verify the guardian again before confirming the physical handover.",
          status: 409 as const,
        };
      }

      const { rows: [updatedLog] } = await client.query<{ id: string }>(
        `update public.missing_logs
         set found_at = now(), found_ghat = $2
         where id = $1 and found_at is null
         returning id`,
        [member.missing_log_id, member.ghat],
      );
      if (!updatedLog) {
        return { error: "This missing report was already completed.", status: 409 as const };
      }
      await client.query("update public.members set status = 'found' where id = $1", [memberId]);
      await client.query(
        `insert into public.volunteer_handovers (missing_log_id, volunteer_id)
         values ($1, $2)`,
        [member.missing_log_id, volunteer.id],
      );
      await client.query(
        "delete from public.volunteer_handover_verifications where missing_log_id = $1",
        [member.missing_log_id],
      );
      const { rows: [counts] } = await client.query<{ personal: number; total: number }>(
        `select count(*) filter (where volunteer_id = $1)::int as personal,
                count(*)::int as total
         from public.volunteer_handovers`,
        [volunteer.id],
      );
      return { counts: counts ?? { personal: 0, total: 0 } };
    });
    if ("error" in result && result.error) return apiError(result.error, result.status);
    return NextResponse.json({ status: "handed_over", counts: result.counts }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Volunteer handover confirmation failed.", error);
    return apiError("Could not confirm this handover. Please try again.", 500);
  }
}
