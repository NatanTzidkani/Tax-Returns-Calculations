/**
 * File storage boundary (spec §2): local disk in phase 1; an S3-compatible
 * adapter later only needs to implement this interface.
 */
export interface Storage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
