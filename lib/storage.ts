import { getAdminStorage } from './firebase-admin';

/**
 * Upload a file to Firebase Storage and return its public URL.
 * The file is made publicly readable after upload.
 *
 * @param storagePath  Full path inside the bucket, e.g. "request-documents/{id}/file.pdf"
 * @param fileBuffer   Raw file bytes
 * @param contentType  MIME type, e.g. "application/pdf"
 */
export async function uploadFile(
  storagePath: string,
  fileBuffer: ArrayBuffer,
  contentType: string
): Promise<string> {
  const storage = getAdminStorage();
  const bucket = storage.bucket();
  const fileRef = bucket.file(storagePath);

  await fileRef.save(Buffer.from(fileBuffer), {
    metadata: { contentType },
    resumable: false,
  });

  await fileRef.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}
