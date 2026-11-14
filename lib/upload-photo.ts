"use client";

export async function uploadPhoto(file: File, memberId: string, photoType: string): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("memberId", memberId);
  formData.set("photoType", photoType);

  const response = await fetch("/api/photos/upload", { method: "POST", body: formData });
  const body = await response.json() as { storagePath?: string; error?: string };
  if (!response.ok || !body.storagePath) {
    throw new Error(body.error ?? "Photo upload failed.");
  }
  return body.storagePath;
}
