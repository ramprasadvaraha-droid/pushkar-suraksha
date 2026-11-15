import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isServerConfigured } from "@/lib/server-neon";
import { deletePhotos } from "@/lib/neon-storage";
import { deleteFaceEmbeddings } from "@/lib/face-search";

interface ExpiredPhoto {
  id: string;
  storage_path: string;
  member_id: string;
  photo_type: string;
  face_search_consent: boolean;
}

interface PendingFaceCleanup {
  family_id: string;
  member_ids: string[];
}

export async function GET(request: Request) {
  if (!isServerConfigured()) {
    return NextResponse.json({ error: "Server configuration is incomplete." }, { status: 503 });
  }
  const expectedSecret = process.env.CRON_SECRET;
  const suppliedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expectedSecret || !suppliedSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const expected = Buffer.from(expectedSecret);
  const supplied = Buffer.from(suppliedSecret);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { rows: pendingFamilies } = await query<PendingFaceCleanup>(
      `select f.id as family_id, array_agg(m.id) as member_ids
       from public.families f
       join public.members m on m.family_id = f.id and m.owner_id = f.owner_id
       where f.face_search_index_pending = true
       group by f.id`,
    );
    for (const family of pendingFamilies) {
      await deleteFaceEmbeddings(family.member_ids);
      await query(
        `update public.families set face_search_index_pending = false
         where id = $1 and face_search_consent = false`,
        [family.family_id],
      );
    }

    const { rows } = await query<ExpiredPhoto>(
      `select p.id, p.storage_path, p.member_id, p.photo_type, f.face_search_consent
       from public.photos p
       join public.families f on f.id = p.family_id and f.owner_id = p.owner_id
       where p.expires_at <= now() order by p.expires_at limit 500`,
    );
    if (!rows.length) {
      await query("delete from public.face_search_audit where searched_at < now() - interval '90 days'");
      return NextResponse.json({ deleted: 0 });
    }

    const expiredFaceMembers = [...new Set(rows
      .filter((photo) => photo.photo_type === "face_front" && photo.face_search_consent)
      .map((photo) => photo.member_id))];
    if (expiredFaceMembers.length) {
      await deleteFaceEmbeddings(expiredFaceMembers);
    }

    try {
      await deletePhotos(rows.map((photo) => photo.storage_path));
    } catch (storageError) {
      console.error("Expired family photo storage cleanup failed.", storageError);
      return NextResponse.json({ error: "Expired photos could not be removed from storage." }, { status: 502 });
    }

    const ids = rows.map((photo) => photo.id);
    await query("delete from public.photos where id = any($1::uuid[])", [ids]);
    await query("delete from public.face_search_audit where searched_at < now() - interval '90 days'");
    return NextResponse.json({ deleted: rows.length });
  } catch (error) {
    console.error("Expired family photo cleanup failed.", error);
    return NextResponse.json({ error: "Expired family photos could not be cleaned up." }, { status: 500 });
  }
}
