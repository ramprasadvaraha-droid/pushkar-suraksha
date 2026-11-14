import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const PHOTO_BUCKET = "family-photos";

let client: S3Client | undefined;

function getStorageClient(): S3Client {
  const endpoint = process.env.AWS_ENDPOINT_URL_S3;
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!endpoint || !region || !accessKeyId || !secretAccessKey) {
    throw new Error("Neon Object Storage is not configured. Check the AWS_* environment variables.");
  }
  client ??= new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  return client;
}

export async function uploadPhoto(key: string, body: Uint8Array, contentType: string): Promise<void> {
  await getStorageClient().send(new PutObjectCommand({
    Bucket: PHOTO_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

export async function verifyPhoto(key: string): Promise<void> {
  await getStorageClient().send(new HeadObjectCommand({ Bucket: PHOTO_BUCKET, Key: key }));
}

export async function createPhotoUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    getStorageClient(),
    new GetObjectCommand({ Bucket: PHOTO_BUCKET, Key: key }),
    { expiresIn },
  );
}

export async function deletePhotos(keys: string[]): Promise<void> {
  if (!keys.length) return;
  const result = await getStorageClient().send(new DeleteObjectsCommand({
    Bucket: PHOTO_BUCKET,
    Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
  }));
  if (result.Errors?.length) {
    throw new Error(`Neon Object Storage could not delete ${result.Errors.length} photo(s).`);
  }
}
