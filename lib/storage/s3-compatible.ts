import 'server-only';

import type { BabyChainStorageProviderId, StorageProvider } from './types';

export type S3CompatibleConfig = {
  accessKeyId: string;
  bucket: string;
  endpoint?: string | null;
  forcePathStyle?: boolean;
  publicBaseUrl: string;
  region: string;
  secretAccessKey: string;
};

type S3ClientModule = {
  PutObjectCommand: new (input: Record<string, unknown>) => unknown;
  S3Client: new (config: Record<string, unknown>) => {
    send(command: unknown): Promise<unknown>;
  };
};

export function createS3CompatibleStorageProvider({
  config,
  id,
  label,
}: {
  config: S3CompatibleConfig;
  id: BabyChainStorageProviderId;
  label: string;
}): StorageProvider {
  return {
    id,
    label,
    async store(input) {
      const { PutObjectCommand, S3Client } = await loadS3Client();
      const client = new S3Client({
        region: config.region,
        endpoint: config.endpoint ?? undefined,
        forcePathStyle: config.forcePathStyle ?? false,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });

      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: input.key,
          Body: input.data,
          ContentType: input.contentType,
        }),
      );

      return {
        publicUrl: buildPublicUrl(config.publicBaseUrl, input.key),
        storagePath: input.key,
      };
    },
  };
}

function buildPublicUrl(baseUrl: string, key: string) {
  const base = baseUrl.replace(/\/+$/, '');
  const safeKey = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `${base}/${safeKey}`;
}

async function loadS3Client(): Promise<S3ClientModule> {
  try {
    return (await import('@aws-sdk/client-s3')) as unknown as S3ClientModule;
  } catch {
    throw new Error(
      'aws-s3 storage is selected but @aws-sdk/client-s3 is not installed.',
    );
  }
}
