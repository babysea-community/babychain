export type BabyChainStorageProviderId = 'aws-s3' | 'vercel-blob';

export type StoreInput = {
  contentType: string;
  data: Uint8Array;
  key: string;
};

export type StoreResult = {
  publicUrl: string | null;
  storagePath: string;
};

export type StorageProvider = {
  readonly id: BabyChainStorageProviderId;
  readonly label: string;
  store(input: StoreInput): Promise<StoreResult>;
  /**
   * Permanently delete stored objects by their storage path (an S3 object key
   * or a Vercel Blob pathname). Best-effort: already-missing objects are
   * ignored. Used when an owner deletes a canvas to reclaim its image/video
   * files while keeping the database history rows.
   */
  remove(keys: string[]): Promise<void>;
};
