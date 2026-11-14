import { query } from "@/lib/db";

export interface ApprovedVolunteer {
  id: string;
  email: string | null;
  fullName: string;
  phone: string | null;
}

export function getVolunteerOrganizerEmails(): string[] {
  return (process.env.VOLUNTEER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isVolunteerOrganizer(email?: string | null): boolean {
  return Boolean(email && getVolunteerOrganizerEmails().includes(email.trim().toLowerCase()));
}

export async function getApprovedVolunteer(authUserId: string): Promise<ApprovedVolunteer | null> {
  const { rows: [volunteer] } = await query<ApprovedVolunteer>(
    `select id, email, full_name as "fullName", phone
     from public.volunteers
     where auth_user_id = $1 and status = 'approved'`,
    [authUserId],
  );
  return volunteer ?? null;
}
