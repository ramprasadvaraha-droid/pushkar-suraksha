import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { apiError, isServerConfigured } from "@/lib/server-neon";
import { createPhotoUrl } from "@/lib/neon-storage";

interface FoundRow {
  member_number: string;
  found_ghat: string | null;
  found_at: string;
  storage_path: string | null;
}

export async function GET() {
  if (!isServerConfigured()) return apiError("Server configuration is incomplete. Check the README environment setup.", 503);
  try {
    const { rows } = await query<FoundRow>(
      `select m.member_number, ml.found_ghat, ml.found_at, photo.storage_path
       from public.missing_logs ml
       join public.members m on m.id = ml.member_id
       left join lateral (
         select p.storage_path from public.photos p
         where p.member_id = m.id and p.photo_type = 'face_front'
         order by p.created_at desc limit 1
       ) photo on true
       where ml.found_at is not null
       order by ml.found_at desc limit 50`,
    );
    if (!rows.length) return NextResponse.json({ found: [] });

    const found = await Promise.all(rows.map(async (row) => {
      return {
        memberNumber: row.member_number,
        photoUrl: row.storage_path ? await createPhotoUrl(row.storage_path) : null,
        ghat: row.found_ghat,
        foundAt: row.found_at,
      };
    }));
    return NextResponse.json({ found });
  } catch (error) {
    console.error("Public found-board lookup failed.", error);
    return NextResponse.json({ error: "Found board is temporarily unavailable." }, { status: 500 });
  }
}
