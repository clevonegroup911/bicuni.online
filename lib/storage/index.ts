import { createHash } from "node:crypto";
import { Storage } from "@google-cloud/storage";

export type StoredObjectDigest = {
  exists: boolean;
  sizeBytes?: number;
  contentType?: string;
  checksum?: string;
  reference?: {
    bucket: string;
    objectKey: string;
    generation?: string;
  };
};

export interface StorageProvider {
  createSignedUpload(input: { objectKey: string; contentType: string; expiresInSeconds: number }): Promise<string>;
  createSignedDownload(objectKey: string, fileName: string, expiresInSeconds: number, preview?: boolean): Promise<string>;
  delete(objectKey: string): Promise<void>;
  stat(objectKey: string): Promise<{ exists: boolean; sizeBytes?: number; contentType?: string }>;
  digest(objectKey: string): Promise<StoredObjectDigest>;
  createThumbnail(objectKey: string, title: string, type: string): Promise<void>;
}

export function safeObjectKey(userId: string, fileName: string) {
  const clean = fileName.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(-120) || "document";
  return `users/${userId}/${crypto.randomUUID()}-${clean}`;
}

let provider: StorageProvider | undefined;

export function privateStorage() {
  provider ??= new GoogleCloudStorageProvider();
  return provider;
}

class GoogleCloudStorageProvider implements StorageProvider {
  private readonly storage = new Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
  private readonly bucketName = requiredBucket();

  async createSignedUpload({ objectKey, contentType, expiresInSeconds }: { objectKey: string; contentType: string; expiresInSeconds: number }) {
    const [url] = await this.storage.bucket(this.bucketName).file(objectKey).getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + expiresInSeconds * 1000,
      contentType,
    });
    return url;
  }

  async createSignedDownload(objectKey: string, fileName: string, expiresInSeconds: number, preview = false) {
    const disposition = `${preview ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(fileName)}`;
    const [url] = await this.storage.bucket(this.bucketName).file(objectKey).getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + expiresInSeconds * 1000,
      responseDisposition: disposition,
    });
    return url;
  }

  async delete(objectKey: string) {
    await this.storage.bucket(this.bucketName).file(objectKey).delete({ ignoreNotFound: true });
  }

  async stat(objectKey: string) {
    const file = this.storage.bucket(this.bucketName).file(objectKey);
    const [exists] = await file.exists();
    if (!exists) return { exists: false };
    const [metadata] = await file.getMetadata();
    return {
      exists: true,
      sizeBytes: typeof metadata.size === "string" ? Number(metadata.size) : metadata.size,
      contentType: metadata.contentType,
    };
  }

  async digest(objectKey: string): Promise<StoredObjectDigest> {
    const file = this.storage.bucket(this.bucketName).file(objectKey);
    const [exists] = await file.exists();
    if (!exists) return { exists: false };
    const [metadata] = await file.getMetadata();
    const hash = createHash("sha256");
    let sizeBytes = 0;
    await new Promise<void>((resolve, reject) => {
      file.createReadStream()
        .on("data", (chunk: Buffer) => {
          sizeBytes += chunk.length;
          hash.update(chunk);
        })
        .on("error", reject)
        .on("end", () => resolve());
    });
    return {
      exists: true,
      sizeBytes,
      contentType: metadata.contentType,
      checksum: hash.digest("hex"),
      reference: {
        bucket: this.bucketName,
        objectKey,
        generation: typeof metadata.generation === "string" ? metadata.generation : undefined,
      },
    };
  }

  async createThumbnail(objectKey: string, title: string, type: string) {
    const safeTitle = title.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1100"><rect width="800" height="1100" fill="#020617"/><rect x="48" y="48" width="704" height="1004" rx="32" fill="#0f172a" stroke="#2563eb" stroke-width="4"/><text x="90" y="150" fill="#dc2626" font-family="Arial" font-size="34" font-weight="700">BICUNI · ${type}</text><foreignObject x="90" y="220" width="620" height="650"><div xmlns="http://www.w3.org/1999/xhtml" style="font:700 52px Arial;color:#f8fafc;line-height:1.2">${safeTitle}</div></foreignObject><text x="90" y="970" fill="#94a3b8" font-family="Arial" font-size="26">Bibliothèque Centrale Universelle</text></svg>`;
    await this.storage.bucket(this.bucketName).file(objectKey).save(svg, { contentType: "image/svg+xml", resumable: false, metadata: { cacheControl: "private, max-age=3600" } });
  }
}

function requiredBucket() {
  const bucket = process.env.GCS_BUCKET;
  if (!bucket) throw new Error("GCS_BUCKET n’est pas configuré.");
  return bucket;
}
