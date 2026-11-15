import { downloadPhoto } from "@/lib/neon-storage";

interface FaceMatch {
  memberId: string;
  similarity: number;
}

interface FaceSearchResponse {
  matches: FaceMatch[];
  minimumSimilarity: number;
}

export class FaceSearchServiceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "FaceSearchServiceError";
  }
}

function getServiceConfig() {
  const configuredUrl = process.env.FACE_SEARCH_SERVICE_URL;
  const token = process.env.FACE_SEARCH_SERVICE_TOKEN;
  if (!configuredUrl || !token || token.length < 32) {
    throw new Error("Face search is not configured. Set the private face-search service URL and token.");
  }
  const url = new URL(configuredUrl);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("Face-search service must use HTTPS outside local development.");
  }
  return { baseUrl: `${url.href.replace(/\/+$/, "")}/`, token };
}

export function assertFaceSearchConfigured(): void {
  getServiceConfig();
}

async function serviceRequest(path: string, init: RequestInit): Promise<Response> {
  const { baseUrl, token } = getServiceConfig();
  let response: Response;
  try {
    response = await fetch(new URL(path, baseUrl), {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new Error("Face-search service could not be reached.", { cause: error });
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new FaceSearchServiceError(
      body?.detail ?? "Face-search service rejected the request.",
      response.status,
    );
  }
  return response;
}

export async function enrollFacePhoto(memberId: string, storagePath: string): Promise<void> {
  assertFaceSearchConfigured();
  const { bytes, contentType } = await downloadPhoto(storagePath);
  await serviceRequest(`v1/enroll/${encodeURIComponent(memberId)}`, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: Buffer.from(bytes),
  });
}

export async function deleteFaceEmbeddings(memberIds: string[]): Promise<void> {
  if (!memberIds.length) return;
  await serviceRequest("v1/embeddings/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberIds: [...new Set(memberIds)] }),
  });
}

export async function searchFaces(
  image: Uint8Array,
  contentType: string,
  candidateIds: string[],
): Promise<FaceSearchResponse> {
  const form = new FormData();
  form.append("candidate_ids", JSON.stringify(candidateIds));
  form.append("image", new Blob([Buffer.from(image)], { type: contentType }), "search-photo");
  const response = await serviceRequest("v1/search", { method: "POST", body: form });
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("matches" in body) ||
      !Array.isArray(body.matches) || !("minimumSimilarity" in body) ||
      typeof body.minimumSimilarity !== "number") {
    throw new Error("Face-search service returned an invalid response.");
  }
  const matches = body.matches.flatMap((match): FaceMatch[] => {
    if (!match || typeof match !== "object" || !("memberId" in match) ||
        typeof match.memberId !== "string" || !("similarity" in match) ||
        typeof match.similarity !== "number" || !Number.isFinite(match.similarity)) {
      return [];
    }
    return [{ memberId: match.memberId, similarity: match.similarity }];
  });
  if (matches.length !== body.matches.length) {
    throw new Error("Face-search service returned invalid match data.");
  }
  return { matches, minimumSimilarity: body.minimumSimilarity };
}
