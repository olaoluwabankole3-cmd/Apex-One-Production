/**
 * APEX ONE — Object Storage Abstraction for Documents
 * 
 * ARCHITECTURAL NOTICE:
 * In Phase 2, this is an in-memory object storage adapter.
 * In Phase 3, this will connect to Google Cloud Storage (GCS) or S3-compatible enterprise blob storage.
 */

export interface IObjectStorageService {
  putObject(key: string, data: Buffer | string, mimeType: string): Promise<{ uri: string; bytes: number }>;
  getObject(key: string): Promise<{ data: Buffer | string; mimeType: string } | null>;
  deleteObject(key: string): Promise<boolean>;
}

export class InMemoryObjectStorageAdapter implements IObjectStorageService {
  private readonly storage = new Map<string, { data: Buffer | string; mimeType: string; bytes: number }>();

  public async putObject(key: string, data: Buffer | string, mimeType: string): Promise<{ uri: string; bytes: number }> {
    const bytes = typeof data === "string" ? Buffer.byteLength(data, "utf8") : data.length;
    this.storage.set(key, { data, mimeType, bytes });
    return {
      uri: `blob://tenants/${key}`,
      bytes,
    };
  }

  public async getObject(key: string): Promise<{ data: Buffer | string; mimeType: string } | null> {
    const item = this.storage.get(key);
    return item ? { data: item.data, mimeType: item.mimeType } : null;
  }

  public async deleteObject(key: string): Promise<boolean> {
    return this.storage.delete(key);
  }
}

export const objectStorageService: IObjectStorageService = new InMemoryObjectStorageAdapter();
