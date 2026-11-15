import { NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { FaceSearchServiceError, searchFaces } from "@/lib/face-search";
import { apiError, getAuthenticatedUser, isServerConfigured } from "@/lib/server-neon";
import { createPhotoUrl } from "@/lib/neon-storage";
import { getApprovedVolunteer } from "@/lib/volunteer-access";

const MAX_SEARCH_BYTES = 4 * 1024 * 1024;
const MAX_CANDIDATES = 100_000;

interface SearchCandidate {
  member_id: string;
  member_number: string;
  face_path: string;
  ghat: string;
  missing_at: string;
}

async function reserveSearchSlot(volunteerId: string): Promise<string | null> {
  return withTransaction(async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [volunteerId]);
    const { rows: [result] } = await client.query<{ count: number }>(
      `select count(*)::int as count from public.face_search_audit
       where volunteer_id = $1 and searched_at > now() - interval '1 minute'`,
      [volunteerId],
    );
    if (result.count >= 10) return null;
    const { rows: [audit] } = await client.query<{ id: string }>(
      `insert into public.face_search_audit (volunteer_id, result_count)
       values ($1, 0) returning id`,
      [volunteerId],
    );
    return audit.id;
  });
}

export async function POST(request: Request) {
  if (!isServerConfigured()) {
    return apiError("Server configuration is incomplete. Check the README environment setup.", 503);
  }
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Session expired. Please sign in again.", 401);
  const volunteer = await getApprovedVolunteer(user.id);
  if (!volunteer) return apiError("Organizer approval is required before using face search.", 403);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError("Search photo could not be read.");
  }
  const image = form.get("photo");
  if (!(image instanceof File) || !image.size) {
    return apiError("Choose a face photo to search.", 400);
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
    return apiError("Use a JPEG, PNG, or WebP search photo.", 415);
  }
  if (image.size > MAX_SEARCH_BYTES) {
    return apiError("Search photo must be 4 MB or smaller.", 413);
  }

  try {
    const auditId = await reserveSearchSlot(volunteer.id);
    if (auditId === null) return apiError("Search limit reached. Try again in a minute.", 429);

    const { rows: candidates } = await query<SearchCandidate>(
      `select m.id as member_id, m.member_number, face.storage_path as face_path,
              ml.ghat, ml.missing_at
       from public.missing_logs ml
       join public.members m on m.id = ml.member_id
       join public.families f on f.id = m.family_id and f.owner_id = m.owner_id
       join lateral (
         select p.storage_path from public.photos p
         where p.member_id = m.id and p.photo_type = 'face_front' and p.expires_at > now()
         order by p.created_at desc limit 1
       ) face on true
       where ml.found_at is null and m.status = 'missing'
         and f.face_search_consent = true
       order by ml.missing_at desc
       limit $1`,
      [MAX_CANDIDATES],
    );

    let matches: { memberId: string; similarity: number }[] = [];
    let minimumSimilarity = 0.363;
    if (candidates.length) {
      const result = await searchFaces(
        new Uint8Array(await image.arrayBuffer()),
        image.type,
        candidates.map((candidate) => candidate.member_id),
      );
      minimumSimilarity = result.minimumSimilarity;
      const allowed = new Set(candidates.map((candidate) => candidate.member_id));
      matches = result.matches.filter((match) => allowed.has(match.memberId));
    }

    const matchedIds = matches.map((match) => match.memberId);
    const { rows: currentCandidates } = matchedIds.length
      ? await query<SearchCandidate>(
        `select m.id as member_id, m.member_number, face.storage_path as face_path,
                ml.ghat, ml.missing_at
         from public.missing_logs ml
         join public.members m on m.id = ml.member_id
         join public.families f on f.id = m.family_id and f.owner_id = m.owner_id
         join lateral (
           select p.storage_path from public.photos p
           where p.member_id = m.id and p.photo_type = 'face_front' and p.expires_at > now()
           order by p.created_at desc limit 1
         ) face on true
         where ml.found_at is null and m.status = 'missing'
           and f.face_search_consent = true and m.id = any($1::uuid[])`,
        [matchedIds],
      )
      : { rows: [] as SearchCandidate[] };

    const byId = new Map(currentCandidates.map((candidate) => [candidate.member_id, candidate]));
    const eligibleMatches = matches.filter((match) => byId.has(match.memberId));
    await query(
      "update public.face_search_audit set result_count = $2 where id = $1",
      [auditId, eligibleMatches.length],
    );
    const results = await Promise.all(eligibleMatches.map(async (match) => {
      const candidate = byId.get(match.memberId);
      if (!candidate) throw new Error("Face-search candidate disappeared during result mapping.");
      return {
        memberId: candidate.member_id,
        memberNumber: candidate.member_number,
        photoUrl: await createPhotoUrl(candidate.face_path, 600),
        ghat: candidate.ghat,
        missingAt: candidate.missing_at,
        similarity: match.similarity,
      };
    }));

    return NextResponse.json({
      candidates: results,
      minimumSimilarity,
      message: "Similarity ranks are suggestions, not identity verification.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Approved volunteer face search failed.", error);
    if (error instanceof FaceSearchServiceError && error.status >= 400 && error.status < 500) {
      return apiError(error.message, error.status);
    }
    return apiError("Face search could not be completed. Follow the normal missing-person procedure.", 503);
  }
}
