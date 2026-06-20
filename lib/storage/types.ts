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
};
