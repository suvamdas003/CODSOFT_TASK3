import { assertValidKey, type StorageAdapter } from "@/server/storage/types";

/** In-memory storage adapter for integration tests. */
export class MemoryStorage implements StorageAdapter {
  readonly driver = "local" as const;
  readonly files = new Map<string, Buffer>();

  async put(key: string, data: Buffer) {
    assertValidKey(key);
    this.files.set(key, Buffer.from(data));
  }
  async get(key: string) {
    const data = this.files.get(key);
    if (!data) throw new Error(`Missing object ${key}`);
    return data;
  }
  async delete(key: string) {
    this.files.delete(key);
  }
  async check() {}
}
