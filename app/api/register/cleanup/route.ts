import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { apiError, getAuthenticatedUser, isServerConfigured } from "@/lib/server-neon";
import { deletePhotos } from "@/lib/neon-storage";

export async function POST(request: Request) {
  if (!isServerConfigured()) return apiError("Server configuration is incomplete. Check the README environment setup.", 503);
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Session expired. Please try again.", 401);
  let body: { familyId?: string; storagePaths?: string[] };
  try {
    body = await request.json();
  } catch {
    return apiError("Cleanup details could not be read.");
  }
  if (!body.familyId || !Array.isArray(body.storagePaths) || body.storagePaths.length > 36 ||
      body.storagePaths.some((path) => typeof path !== "string" || !path.startsWith(`${user.id}/${body.familyId}/`))) {
    return apiError("Cleanup request is invalid.");
  }

  if (body.storagePaths.length) {
    try {
      await deletePhotos(body.storagePaths);
    } catch (error) {
      console.error("Partial registration storage cleanup failed.", error);
      return apiError("Could not clean up uploaded photos. Contact the festival help desk.", 500);
    }
  }
  try {
    await query("delete from public.families where id = $1 and owner_id = $2", [body.familyId, user.id]);
  } catch (error) {
    console.error("Partial family registration cleanup failed.", error);
    return apiError("Could not remove the incomplete family registration.", 500);
  }
  return new NextResponse(null, { status: 204 });
}
