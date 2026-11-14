import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { apiError, getAuthenticatedUser, isServerConfigured } from "@/lib/server-neon";
import { uploadPhoto } from "@/lib/neon-storage";
import type { PhotoType } from "@/lib/types";

const photoTypes = new Set<PhotoType>(["face_front", "full_body", "side", "with_family", "dress_today"]);
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxFileSize = 10 * 1024 * 1024;

export async function POST(request: Request) {
  if (!isServerConfigured()) return apiError("Server configuration is incomplete. Check the README environment setup.", 503);
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Session expired. Please sign in again.", 401);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("Photo upload could not be read.");
  }
  const memberId = formData.get("memberId");
  const rawPhotoType = formData.get("photoType");
  const file = formData.get("file");
  if (typeof memberId !== "string" || typeof rawPhotoType !== "string" ||
      !photoTypes.has(rawPhotoType as PhotoType) || !(file instanceof File)) {
    return apiError("Select a valid family member and photo.");
  }
  if (!allowedTypes.has(file.type) || file.size === 0 || file.size > maxFileSize) {
    return apiError("Photo must be a non-empty JPEG, PNG, or WebP file under 10 MB.");
  }

  try {
    const { rows } = await query<{ id: string; family_id: string; age: number }>(
      `select id, family_id, age from public.members where id = $1 and owner_id = $2`,
      [memberId, user.id],
    );
    const member = rows[0];
    if (!member) return apiError("This member is not in your family.", 404);
    if (rawPhotoType === "dress_today" && member.age >= 18) {
      return apiError("Dress photos are only for children in your family.", 400);
    }

    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const storagePath = `${user.id}/${member.family_id}/${member.id}/${rawPhotoType}-${randomUUID()}.${extension}`;
    await uploadPhoto(storagePath, new Uint8Array(await file.arrayBuffer()), file.type);
    return NextResponse.json({ storagePath }, { status: 201 });
  } catch (error) {
    console.error("Neon photo upload failed.", error);
    return apiError("Could not securely upload this photo. Please try again.", 502);
  }
}
