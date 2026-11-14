import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { apiError, getAuthenticatedUser, isServerConfigured } from "@/lib/server-neon";
import { createPhotoUrl } from "@/lib/neon-storage";

interface FamilyRow {
  id: string;
  family_name: string;
  phone: string;
  alternative_phone: string | null;
  district: string;
  family_number: string;
  verification_hint: string;
  created_at: string;
}

interface MemberRow {
  id: string;
  name: string;
  age: number;
  relation: string;
  gender: string;
  member_number: string;
  status: "safe" | "missing" | "found";
}

interface PhotoRow {
  member_id: string;
  photo_type: string;
  storage_path: string;
  created_at: string;
}

export async function GET() {
  if (!isServerConfigured()) return apiError("Server configuration is incomplete. Check the README environment setup.", 503);
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Session expired. Please sign in again.", 401);

  try {
    const { rows: families } = await query<FamilyRow>(
      `select id, family_name, phone, alternative_phone, district, family_number, verification_hint, created_at
       from public.families where owner_id = $1 order by created_at desc limit 1`,
      [user.id],
    );
    if (!families.length) return NextResponse.json({ family: null });

    const family = families[0];
    const [{ rows: members }, { rows: photoRows }] = await Promise.all([
      query<MemberRow>(
        `select id, name, age, relation, gender, member_number, status
         from public.members where family_id = $1 and owner_id = $2 order by created_at asc`,
        [family.id, user.id],
      ),
      query<PhotoRow>(
        `select member_id, photo_type, storage_path, created_at
         from public.photos where family_id = $1 and owner_id = $2 order by created_at desc`,
        [family.id, user.id],
      ),
    ]);

    const memberResults = await Promise.all(members.map(async (member) => {
      const memberPhotos = photoRows.filter((photo) => photo.member_id === member.id);
      const urls = await Promise.all(memberPhotos.map(async (photo) => ({
        type: photo.photo_type,
        url: await createPhotoUrl(photo.storage_path),
      })));
      const photos: Record<string, string> = {};
      for (const photo of urls) {
        photos[photo.type] ??= photo.url;
      }
      return { ...member, photos };
    }));
    const { verification_hint: secretHint, ...safeFamily } = family;
    return NextResponse.json({
      family: { ...safeFamily, members: memberResults },
      secretHint,
    });
  } catch (error) {
    console.error("Family data lookup failed.", error);
    return apiError("Could not load your family details.", 500);
  }
}
