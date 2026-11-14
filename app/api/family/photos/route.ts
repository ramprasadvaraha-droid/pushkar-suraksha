import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { apiError, getAuthenticatedUser, isServerConfigured } from "@/lib/server-neon";
import { deletePhotos } from "@/lib/neon-storage";

interface FamilyRow {
  id: string;
}

interface PhotoRow {
  id: string;
  storage_path: string;
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
      `select id from public.families where owner_id = $1 order by created_at desc limit 1`,
      [user.id],
    );
    const family = families[0];
    if (!family) return apiError("Your family registration was not found.", 404);

    const { rows: photos } = await query<PhotoRow>(
      `select id, storage_path from public.photos where family_id = $1 and owner_id = $2`,
      [family.id, user.id],
    );
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
