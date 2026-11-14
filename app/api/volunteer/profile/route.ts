import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { apiError, getAuthenticatedUser, isServerConfigured } from "@/lib/server-neon";
import { getVolunteerOrganizerEmails, isVolunteerOrganizer } from "@/lib/volunteer-access";

type VolunteerStatus = "pending" | "approved" | "rejected";

interface VolunteerProfileRow {
  id: string;
  email: string | null;
  fullName: string;
  phone: string | null;
  status: VolunteerStatus;
  createdAt: string;
}

interface HandoverCounts {
  personal: number;
  total: number;
}

export async function GET() {
  if (!isServerConfigured()) return apiError("Server configuration is incomplete. Check the README environment setup.", 503);
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Session expired. Please sign in again.", 401);

  try {
    const email = user.emailVerified === true ? user.email?.trim().toLowerCase() ?? "" : "";
    const { rows: [profile] } = await query<VolunteerProfileRow>(
      `select id, email, full_name as "fullName", phone, status, created_at as "createdAt"
       from public.volunteers where auth_user_id = $1`,
      [user.id],
    );
    const organizer = user.emailVerified === true && isVolunteerOrganizer(email);
    let counts: HandoverCounts | null = null;
    if (profile?.status === "approved" || organizer) {
      const { rows: [result] } = await query<HandoverCounts>(
        `select count(*) filter (where volunteer_id = $1)::int as personal,
                count(*)::int as total
         from public.volunteer_handovers`,
        [profile?.status === "approved" ? profile.id : null],
      );
      counts = result ?? { personal: 0, total: 0 };
    }

    return NextResponse.json({
      profile: profile ?? null,
      isOrganizer: organizer,
      organizerConfigured: getVolunteerOrganizerEmails().length > 0,
      counts,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Volunteer profile lookup failed.", error);
    return apiError("Could not load volunteer registration.", 500);
  }
}

export async function POST(request: Request) {
  if (!isServerConfigured()) return apiError("Server configuration is incomplete. Check the README environment setup.", 503);
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Session expired. Please sign in again.", 401);
  if (user.emailVerified !== true && user.phoneNumberVerified !== true) {
    return apiError("Verify your email address or mobile number before volunteer registration.", 403);
  }
  if (!getVolunteerOrganizerEmails().length) {
    return apiError("Volunteer organizer access is not configured. Contact the festival coordinator.", 503);
  }

  let body: { fullName?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("Volunteer registration details could not be read.");
  }
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  if (fullName.length < 2 || fullName.length > 100) {
    return apiError("Enter your full name (2 to 100 characters).");
  }
  const email = user.emailVerified === true ? user.email?.trim().toLowerCase() ?? null : null;
  const authenticatedPhone = user.phoneNumberVerified === true
    ? user.phoneNumber?.replace(/^\+91/, "") ?? null
    : null;
  if (user.emailVerified === true && !email) {
    return apiError("Your verified sign-in account does not have an email address.", 400);
  }
  if (!email && !authenticatedPhone) {
    return apiError("Your account must have a verified email or mobile number.", 403);
  }

  if (authenticatedPhone && !/^[6-9]\d{9}$/.test(authenticatedPhone)) {
    return apiError("Your verified sign-in account does not have a valid mobile number.", 400);
  }
  const phone = authenticatedPhone;
  const organizer = email ? isVolunteerOrganizer(email) : false;

  try {
    const { rows: [profile] } = await query<VolunteerProfileRow>(
      `insert into public.volunteers (auth_user_id, email, full_name, phone, status, reviewed_at, reviewed_by)
       values ($1, $2, $3, $4, $5, case when $5 = 'approved' then now() else null end,
               case when $5 = 'approved' then $1 else null end)
       on conflict (auth_user_id) do update set
         email = excluded.email,
         full_name = excluded.full_name,
         phone = excluded.phone,
         status = case
           when excluded.status = 'approved' then 'approved'
           when volunteers.status = 'rejected' then 'pending'
           else volunteers.status
         end,
         reviewed_at = case
           when excluded.status = 'approved' then now()
           when volunteers.status = 'rejected' then null
           else volunteers.reviewed_at
         end,
         reviewed_by = case
           when excluded.status = 'approved' then excluded.reviewed_by
           when volunteers.status = 'rejected' then null
           else volunteers.reviewed_by
         end
       returning id, email, full_name as "fullName", phone, status, created_at as "createdAt"`,
      [user.id, email, fullName, phone, organizer ? "approved" : "pending"],
    );
    return NextResponse.json({ profile }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Volunteer registration failed.", error);
    return apiError("Could not save volunteer registration.", 500);
  }
}
