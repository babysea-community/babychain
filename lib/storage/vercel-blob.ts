import 'server-only';

import type { StorageProvider } from './types';

type VercelBlobModule = {
  put(
    pathname: string,
    body: Uint8Array | Buffer | Blob,
    options: {
      access: 'public';
      addRandomSuffix?: boolean;
      allowOverwrite?: boolean;
      contentType: string;
      token: string;
    },
  ): Promise<{ url: string }>;
};

export function createVercelBlobStorageProvider(): StorageProvider {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (!token) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN is required when BABYCHAIN_STORAGE_PROVIDER=vercel-blob.',
    );
  }

  return {
    id: 'vercel-blob',
    label: 'vercel-blob',
    async store(input) {
      const blob = await loadVercelBlob();
      const result = await blob.put(input.key, input.data, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: input.contentType,
        token,
      });

      return { publicUrl: result.url, storagePath: input.key };
    },
  };
}

async function loadVercelBlob(): Promise<VercelBlobModule> {
  try {
    return (await import('@vercel/blob')) as unknown as VercelBlobModule;
  } catch {
    throw new Error(
      'vercel-blob storage is selected but @vercel/blob is not installed.',
    );
  }
}
