import { NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { apiError, getAuthenticatedUser, isServerConfigured } from "@/lib/server-neon";
import { createPhotoUrl, deletePhotos, verifyPhoto } from "@/lib/neon-storage";

interface MemberRow {
  id: string;
  age: number;
  family_id: string;
}

export async function POST(request: Request) {
  if (!isServerConfigured()) return apiError("Server configuration is incomplete. Check the README environment setup.", 503);
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Session expired. Please try again.", 401);
  let body: { memberId?: string; storagePath?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("Dress photo details could not be read.");
  }
  if (!body.memberId || !body.storagePath) return apiError("Select a child and upload today's dress photo.");

  try {
    const { rows: members } = await query<MemberRow>(
      `select id, age, family_id from public.members
       where id = $1 and owner_id = $2`,
      [body.memberId, user.id],
    );
    const member = members[0];
    if (!member || member.age >= 18) return apiError("Dress photos are only for children in your family.", 404);
    const prefix = `${user.id}/${member.family_id}/${member.id}/dress_today-`;
    if (!body.storagePath.startsWith(prefix) || !/\.(jpg|png|webp)$/.test(body.storagePath)) {
      return apiError("This photo does not belong to the selected child.", 400);
    }

    try {
      await verifyPhoto(body.storagePath);
    } catch (verifyError) {
      console.error("Dress photo upload could not be verified.", verifyError);
      return apiError("Dress photo is not available in secure storage. Please upload it again.", 422);
    }

    const previous = await withTransaction(async (client) => {
      const { rows: priorPhotos } = await client.query<{ storage_path: string }>(
        `select storage_path from public.photos
         where member_id = $1 and owner_id = $2 and photo_type = 'dress_today'`,
        [member.id, user.id],
      );
      await client.query(
        `insert into public.photos (family_id, member_id, owner_id, photo_type, storage_path)
         values ($1, $2, $3, 'dress_today', $4)`,
        [member.family_id, member.id, user.id, body.storagePath],
      );
      await client.query(
        `delete from public.photos where member_id = $1 and owner_id = $2
         and photo_type = 'dress_today' and storage_path <> $3`,
        [member.id, user.id, body.storagePath],
      );
      return priorPhotos.map((photo) => photo.storage_path);
    });

    if (previous.length) {
      try {
        await deletePhotos(previous);
      } catch (error) {
        console.error("Old dress photo cleanup failed.", error);
        return apiError("New dress photo is saved, but old photo cleanup failed. Contact the festival help desk.", 500);
      }
    }

    let photoUrl: string;
    try {
      photoUrl = await createPhotoUrl(body.storagePath);
    } catch (signError) {
      console.error("Dress photo saved but signed URL could not be created.", signError);
      return apiError("Photo saved, but its preview could not be loaded. Refresh and try again.", 500);
    }
    return NextResponse.json({ photoUrl });
  } catch (error) {
    console.error("Dress photo database operation failed.", error);
    return apiError("Could not save today's dress photo. Please try again.", 500);
  }
}

export async function DELETE(request: Request) {
  if (!isServerConfigured()) return apiError("Server configuration is incomplete. Check the README environment setup.", 503);
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Session expired. Please try again.", 401);
  let body: { memberId?: string; storagePath?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("Photo cleanup details could not be read.");
  }
  if (!body.memberId || !body.storagePath) return apiError("Photo cleanup details are incomplete.");

  try {
    const { rows: members } = await query<{ id: string; family_id: string }>(
      `select id, family_id from public.members where id = $1 and owner_id = $2`,
      [body.memberId, user.id],
    );
    const member = members[0];
    if (!member || !body.storagePath.startsWith(`${user.id}/${member.family_id}/${member.id}/dress_today-`)) {
      return apiError("This photo does not belong to the selected child.", 404);
    }

    const { rowCount } = await query(
      `delete from public.photos
       where member_id = $1 and owner_id = $2 and storage_path = $3 and photo_type = 'dress_today'`,
      [member.id, user.id, body.storagePath],
    );
    if (!rowCount) return apiError("This dress photo record could not be found.", 404);
    try {
      await deletePhotos([body.storagePath]);
    } catch (storageError) {
      console.error("Dress photo cleanup storage delete failed.", storageError);
      return apiError("Could not clean up the uploaded photo.", 500);
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Dress photo cleanup database operation failed.", error);
    return apiError("Could not clean up the dress photo record.", 500);
  }
}
