import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { apiError, getAuthenticatedUser, isServerConfigured } from "@/lib/server-neon";
import { deletePhotos } from "@/lib/neon-storage";
import { deleteFaceEmbeddings } from "@/lib/face-search";

interface FamilyRow {
  id: string;
  face_search_consent: boolean;
  face_search_index_pending: boolean;
}

interface PhotoRow {
  id: string;
  storage_path: string;
}

interface MemberRow {
  id: string;
}

export async function DELETE(request: Request) {
  if (!isServerConfigured()) return apiError("Server configuration is incomplete. Check the README environment setup.", 503);
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Session expired. Please sign in again.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Photo deletion confirmation could not be read.");
  }
  if (!body || typeof body !== "object" || !("confirmed" in body) || body.confirmed !== true) {
    return apiError("Confirm that you want to permanently delete your family photos.", 400);
  }

  try {
    const { rows: families } = await query<FamilyRow>(
      `select id, face_search_consent, face_search_index_pending
       from public.families where owner_id = $1 order by created_at desc limit 1`,
      [user.id],
    );
    const family = families[0];
    if (!family) return apiError("Your family registration was not found.", 404);

    const { rows: photos } = await query<PhotoRow>(
      `select id, storage_path from public.photos where family_id = $1 and owner_id = $2`,
      [family.id, user.id],
    );
    const { rows: members } = await query<MemberRow>(
      "select id from public.members where family_id = $1 and owner_id = $2",
      [family.id, user.id],
    );

    if (family.face_search_consent || family.face_search_index_pending) {
      await query(
        `update public.families
         set face_search_consent = false, face_search_consent_at = null,
             face_search_consent_version = null, face_search_index_pending = true
         where id = $1 and owner_id = $2`,
        [family.id, user.id],
      );
      try {
        await deleteFaceEmbeddings(members.map((member) => member.id));
        await query(
          "update public.families set face_search_index_pending = false where id = $1 and owner_id = $2",
          [family.id, user.id],
        );
      } catch (indexError) {
        console.error("Family face-template deletion failed.", indexError);
        return apiError("Face templates could not be removed from search. Photos were kept; please retry.", 502);
      }
    }

    if (!photos.length) return NextResponse.json({ deleted: 0 });

    try {
      await deletePhotos(photos.map((photo) => photo.storage_path));
    } catch (storageError) {
      console.error("Family photo deletion from Neon Object Storage failed.", storageError);
      return apiError("Some photos could not be deleted from secure storage. Please retry.", 502);
    }

    try {
      const { rows: deleted } = await query<{ id: string }>(
        `delete from public.photos
         where family_id = $1 and owner_id = $2 and id = any($3::uuid[])
         returning id`,
        [family.id, user.id, photos.map((photo) => photo.id)],
      );
      return NextResponse.json({ deleted: deleted.length });
    } catch (databaseError) {
      console.error("Family photo storage was deleted, but Neon metadata cleanup failed.", databaseError);
      return apiError("Photo files were removed, but their records could not be updated. Retry deletion.", 500);
    }
  } catch (error) {
    console.error("Family photo deletion failed.", error);
    return apiError("Could not delete your family photos. Please try again.", 500);
  }
}
