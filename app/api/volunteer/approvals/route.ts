import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { apiError, getAuthenticatedUser, isServerConfigured } from "@/lib/server-neon";
import { isVolunteerOrganizer } from "@/lib/volunteer-access";

interface PendingVolunteer {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  createdAt: string;
}

async function getOrganizer() {
  const user = await getAuthenticatedUser();
  if (!user) return { error: apiError("Session expired. Please sign in again.", 401) };
  if (user.emailVerified !== true || !isVolunteerOrganizer(user.email)) {
    return { error: apiError("Organizer access is required.", 403) };
  }
  return { user };
}

export async function GET() {
  if (!isServerConfigured()) return apiError("Server configuration is incomplete. Check the README environment setup.", 503);
  const result = await getOrganizer();
  if ("error" in result) return result.error;

  try {
    const { rows } = await query<PendingVolunteer>(
      `select id, email, full_name as "fullName", phone, created_at as "createdAt"
       from public.volunteers where status = 'pending'
       order by created_at asc`,
    );
    return NextResponse.json({ pending: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Pending volunteer lookup failed.", error);
    return apiError("Could not load pending volunteer registrations.", 500);
  }
}

export async function PATCH(request: Request) {
  if (!isServerConfigured()) return apiError("Server configuration is incomplete. Check the README environment setup.", 503);
  const result = await getOrganizer();
  if ("error" in result) return result.error;

  let body: { volunteerId?: string; decision?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("Approval details could not be read.");
  }
  if (!body.volunteerId || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(body.volunteerId) ||
      (body.decision !== "approved" && body.decision !== "rejected")) {
    return apiError("Choose a pending volunteer and an approval decision.");
  }

  try {
    const { rows: [volunteer] } = await query<{ id: string; status: string }>(
      `update public.volunteers
       set status = $2, reviewed_at = now(), reviewed_by = $3
       where id = $1 and status = 'pending'
       returning id, status`,
      [body.volunteerId, body.decision, result.user.id],
    );
    if (!volunteer) return apiError("This registration is no longer pending.", 409);
    return NextResponse.json({ volunteer }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Volunteer approval update failed.", error);
    return apiError("Could not update volunteer approval.", 500);
  }
}
