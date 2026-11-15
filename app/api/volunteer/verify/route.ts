import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { apiError, getAuthenticatedUser, isServerConfigured } from "@/lib/server-neon";
import { getApprovedVolunteer, isVolunteerOrganizer } from "@/lib/volunteer-access";

export async function POST(request: Request) {
  if (!isServerConfigured()) return apiError("Server configuration is incomplete. Check the README environment setup.", 503);
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Session expired. Please sign in again.", 401);
  const volunteer = await getApprovedVolunteer(user.id);
  if (!volunteer) return apiError("Organizer approval is required before using the volunteer desk.", 403);

  let body: {
    memberId?: string;
    ghat?: string;
    verificationSecret?: string;
    verificationMethod?: string;
    coordinatorAttested?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return apiError("Verification details could not be read.");
  }
  const memberId = body.memberId ?? "";
  const ghat = body.ghat?.trim() ?? "";
  const verificationSecret = body.verificationSecret?.trim() ?? "";
  const verificationMethod = body.verificationMethod ?? "secret";
  if (verificationMethod !== "secret" && verificationMethod !== "coordinator") {
    return apiError("Choose a valid guardian verification method.");
  }
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(memberId) ||
      !ghat || ghat.length > 100) {
    return apiError("Choose a valid missing member and found ghat.");
  }
  if (verificationMethod === "secret" && (!verificationSecret || verificationSecret.length > 120)) {
    return apiError("Enter the family verification secret.");
  }
  if (verificationMethod === "coordinator") {
    if (user.emailVerified !== true || !isVolunteerOrganizer(user.email)) {
      return apiError("Only a verified organizer can use this fallback.", 403);
    }
    if (body.coordinatorAttested !== true) {
      return apiError("Confirm you personally verified the guardian in person.");
    }
  }

  try {
    const result = await withTransaction(async (client) => {
      const { rows: [member] } = await client.query<{
        missing_log_id: string;
        phone: string;
        verification_secret_hash: string;
      }>(
        `select ml.id as missing_log_id, f.phone, f.verification_secret_hash
         from public.members m
         join public.families f on f.id = m.family_id
         join public.missing_logs ml on ml.member_id = m.id and ml.found_at is null
         where m.id = $1 and m.status = 'missing'
         for update of m, ml`,
        [memberId],
      );
      if (!member) {
        return { error: "This member is not currently listed as missing.", status: 409 as const };
      }

      if (verificationMethod === "secret") {
        const { rows: [verification] } = await client.query<{ matches: boolean }>(
          `select crypt(encode(digest(lower(trim($1)), 'sha256'), 'hex'), $2) = $2 as matches`,
          [verificationSecret, member.verification_secret_hash],
        );
        if (!verification?.matches) {
          return {
            error: "Family verification did not match. Keep the child with a volunteer and contact the festival coordinator.",
            status: 409 as const,
          };
        }
      }

      const { rows: [claim] } = await client.query<{ missing_log_id: string }>(
        `insert into public.volunteer_handover_verifications
           (missing_log_id, volunteer_id, ghat, verification_method, verified_at)
         values ($1, $2, $3, $4, now())
         on conflict (missing_log_id) do update set
           volunteer_id = excluded.volunteer_id,
           ghat = excluded.ghat,
           verification_method = excluded.verification_method,
           verified_at = now()
         where volunteer_handover_verifications.volunteer_id = excluded.volunteer_id
            or volunteer_handover_verifications.verified_at < now() - interval '15 minutes'
         returning missing_log_id`,
        [member.missing_log_id, volunteer.id, ghat, verificationMethod],
      );
      if (!claim) {
        return {
          error: "Another volunteer is already coordinating this handover. Contact them or the festival coordinator.",
          status: 409 as const,
        };
      }
      return { phone: member.phone, verificationMethod };
    });

    if ("error" in result && result.error) return apiError(result.error, result.status);
    return NextResponse.json({
      status: "verified",
      parentPhone: result.phone,
      verificationMethod: result.verificationMethod,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Guardian verification failed.", error);
    return apiError("Could not verify the guardian. Please try again.", 500);
  }
}
