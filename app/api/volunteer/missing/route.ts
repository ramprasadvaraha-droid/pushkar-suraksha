import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { apiError, getAuthenticatedUser, isServerConfigured } from "@/lib/server-neon";
import { createPhotoUrl } from "@/lib/neon-storage";
import { getApprovedVolunteer } from "@/lib/volunteer-access";

interface MissingRow {
  member_id: string;
  member_number: string;
  face_path: string | null;
  dress_path: string | null;
  ghat: string;
  missing_at: string;
}

export async function GET() {
  if (!isServerConfigured()) return apiError("Server configuration is incomplete. Check the README environment setup.", 503);
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Session expired. Please sign in again.", 401);
  const volunteer = await getApprovedVolunteer(user.id);
  if (!volunteer) return apiError("Organizer approval is required before using the volunteer desk.", 403);
  try {
    const { rows } = await query<MissingRow>(
      `select m.id as member_id, m.member_number, ml.ghat, ml.missing_at,
         face.storage_path as face_path, dress.storage_path as dress_path
       from public.missing_logs ml
       join public.members m on m.id = ml.member_id
       left join lateral (
         select p.storage_path from public.photos p
         where p.member_id = m.id and p.photo_type = 'face_front'
         order by p.created_at desc limit 1
       ) face on true
       left join lateral (
         select p.storage_path from public.photos p
         where p.member_id = m.id and p.photo_type = 'dress_today'
         order by p.created_at desc limit 1
       ) dress on true
       where ml.found_at is null and m.status = 'missing'
       order by ml.missing_at desc`,
    );
    if (!rows.length) {
      return NextResponse.json({ missing: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const missing = await Promise.all(rows.map(async (row) => {
      const [face, dress] = await Promise.all([
        row.face_path
          ? createPhotoUrl(row.face_path)
          : Promise.resolve(null),
        row.dress_path
          ? createPhotoUrl(row.dress_path)
          : Promise.resolve(null),
      ]);
      return {
        memberId: row.member_id,
        memberNumber: row.member_number,
        photoUrl: face,
        dressPhotoUrl: dress,
        ghat: row.ghat,
        missingAt: row.missing_at,
      };
    }));
    return NextResponse.json({ missing }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Volunteer missing list lookup failed.", error);
    return apiError("Could not load the missing-person list.", 500);
  }
}
