import 'server-only';

import type { StorageProvider } from './types';

type VercelBlobModule = {
  del(
    urlOrPathname: string | string[],
    options: { token: string },
  ): Promise<void>;
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
    async remove(keys) {
      const unique = [...new Set(keys.filter((key) => key.length > 0))];

      if (unique.length === 0) {
        return;
      }

      const blob = await loadVercelBlob();
      // `del` accepts blob pathnames (our storagePath) as well as full URLs.
      await blob.del(unique, { token });
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
