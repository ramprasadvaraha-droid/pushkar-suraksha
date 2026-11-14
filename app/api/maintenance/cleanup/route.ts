import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isServerConfigured } from "@/lib/server-neon";
import { deletePhotos } from "@/lib/neon-storage";

interface ExpiredPhoto {
  id: string;
  storage_path: string;
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
    const { rows } = await query<ExpiredPhoto>(
      `select id, storage_path from public.photos
       where expires_at <= now() order by expires_at limit 500`,
    );
    if (!rows.length) return NextResponse.json({ deleted: 0 });

    try {
      await deletePhotos(rows.map((photo) => photo.storage_path));
    } catch (storageError) {
      console.error("Expired family photo storage cleanup failed.", storageError);
      return NextResponse.json({ error: "Expired photos could not be removed from storage." }, { status: 502 });
    }

    const ids = rows.map((photo) => photo.id);
    await query("delete from public.photos where id = any($1::uuid[])", [ids]);
    return NextResponse.json({ deleted: rows.length });
  } catch (error) {
    console.error("Expired family photo cleanup failed.", error);
    return NextResponse.json({ error: "Expired family photos could not be cleaned up." }, { status: 500 });
  }
}
