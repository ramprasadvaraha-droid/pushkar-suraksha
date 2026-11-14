import { NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { apiError, getAuthenticatedUser, isServerConfigured } from "@/lib/server-neon";
import { createPhotoUrl, deletePhotos, verifyPhoto } from "@/lib/neon-storage";
import { PHOTO_TYPES, type PhotoType } from "@/lib/types";

interface UploadedPhoto {
  memberId: string;
  photoType: PhotoType;
  storagePath: string;
}

interface FamilyRow {
  id: string;
  family_name: string;
  phone: string;
  alternative_phone: string | null;
  district: string;
  family_number: string;
  verification_hint: string;
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
}

const isPhotoType = (value: string): value is PhotoType =>
  [...PHOTO_TYPES, "dress_today"].includes(value);

export async function POST(request: Request) {
  if (!isServerConfigured()) return apiError("Server configuration is incomplete. Check the README environment setup.", 503);
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Session expired. Please try again.", 401);
  let body: { familyId?: string; photos?: UploadedPhoto[] };
  try {
    body = await request.json();
  } catch {
    return apiError("Photo details could not be read.");
  }
  if (!body.familyId || !Array.isArray(body.photos) || !body.photos.length || body.photos.length > 36) {
    return apiError("The required family photos are missing.");
  }

  try {
    const { rows: familyRows } = await query<FamilyRow>(
      `select id, family_name, phone, alternative_phone, district, family_number, verification_hint
       from public.families where id = $1 and owner_id = $2`,
      [body.familyId, user.id],
    );
    const family = familyRows[0];
    if (!family) return apiError("This family registration was not found.", 404);

    const { rows: members } = await query<MemberRow>(
      `select id, name, age, relation, gender, member_number, status
       from public.members where family_id = $1 and owner_id = $2 order by created_at asc`,
      [family.id, user.id],
    );
    const expected = new Map<string, Set<string>>();
    for (const member of members) {
      expected.set(member.id, new Set(member.age < 18 ? PHOTO_TYPES : ["face_front"]));
    }
    if (members.length < 1 || members.length > 9) return apiError("Family member list is invalid.", 409);

    const seen = new Set<string>();
    const rows: { familyId: string; memberId: string; ownerId: string; photoType: PhotoType; storagePath: string }[] = [];
    for (const photo of body.photos) {
      if (!photo || typeof photo.memberId !== "string" ||
          typeof photo.photoType !== "string" || typeof photo.storagePath !== "string") {
        return apiError("A photo record is incomplete.", 400);
      }
      const required = expected.get(photo.memberId);
      const prefix = `${user.id}/${family.id}/${photo.memberId}/${photo.photoType}-`;
      if (!required || !isPhotoType(photo.photoType) || !required.has(photo.photoType) ||
          !photo.storagePath.startsWith(prefix) ||
          !/\.(jpg|png|webp)$/.test(photo.storagePath) || seen.has(photo.storagePath)) {
        return apiError("A photo does not belong to this family or member.", 400);
      }
      required.delete(photo.photoType);
      seen.add(photo.storagePath);
      rows.push({
        familyId: family.id,
        memberId: photo.memberId,
        ownerId: user.id,
        photoType: photo.photoType,
        storagePath: photo.storagePath,
      });
    }
    if ([...expected.values()].some((required) => required.size > 0)) {
      return apiError("One or more required family photos are missing.", 400);
    }

    const paths = rows.map((row) => row.storagePath);
    const rollback = async () => {
      try {
        await deletePhotos(paths);
      } catch (storageError) {
        console.error("Registration upload rollback failed.", storageError);
      }
      try {
        await query("delete from public.families where id = $1 and owner_id = $2", [family.id, user.id]);
      } catch (deleteError) {
        console.error("Incomplete family registration rollback failed.", deleteError);
      }
    };

    try {
      try {
        await Promise.all(paths.map(verifyPhoto));
      } catch (verificationError) {
        console.error("Registration uploaded object verification failed.", verificationError);
        await rollback();
        return apiError("One or more photos could not be verified. Please upload them again.", 422);
      }

      await withTransaction(async (client) => {
        for (const row of rows) {
          await client.query(
            `insert into public.photos (family_id, member_id, owner_id, photo_type, storage_path)
             values ($1, $2, $3, $4, $5)`,
            [row.familyId, row.memberId, row.ownerId, row.photoType, row.storagePath],
          );
        }
      });

      const { rows: photoRecords } = await query<PhotoRow>(
        `select member_id, photo_type, storage_path from public.photos
         where family_id = $1 and owner_id = $2 order by created_at desc`,
        [family.id, user.id],
      );
      const membersWithPhotos = await Promise.all(members.map(async (member) => {
        const memberPhotos = photoRecords.filter((photo) => photo.member_id === member.id);
        const signed = await Promise.all(memberPhotos.map(async (photo) => ({
          type: photo.photo_type,
          url: await createPhotoUrl(photo.storage_path, 86400),
        })));
        return { ...member, signed };
      }));
      const finalMembers = membersWithPhotos.map(({ signed, ...member }) => ({
        ...member,
        photos: Object.fromEntries(signed.map((photo) => [photo.type, photo.url])),
      }));
      const { verification_hint: secretHint, ...safeFamily } = family;
      return NextResponse.json({
        family: { ...safeFamily, members: finalMembers },
        secretHint,
      }, { status: 201 });
    } catch (error) {
      await rollback();
      throw error;
    }
  } catch (error) {
    console.error("Registration photo processing failed.", error);
    return apiError("Could not complete the family photo registration. Please try again.", 500);
  }
}
