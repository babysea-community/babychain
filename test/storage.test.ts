import { describe, expect, it, vi } from 'vitest';

import { outputFilesWithStorageUrls } from '@/lib/chains/output-files';
import { resolveAwsS3EndpointConfig } from '@/lib/storage/aws-s3';
import { persistOutputFiles, type StorageProvider } from '@/lib/storage';

const s3EndpointInput = {
  bucket: 'babychain-media',
  region: 'us-east-1',
};

describe('output storage', () => {
  it('ignores non-HTTPS storage metadata URLs', () => {
    expect(
      outputFilesWithStorageUrls({
        files: ['data:image/png;base64,aW1hZ2U='],
        providerMetadata: {
          babychain_storage: {
            assets: [
              {
                output_index: 0,
                url: 'javascript:alert(1)',
              },
            ],
          },
        },
      }),
    ).toEqual(['data:image/png;base64,aW1hZ2U=']);
  });

  it('uses AWS S3 bucket-host URLs as public URLs and strips the bucket for SDK writes', () => {
    expect(
      resolveAwsS3EndpointConfig({
        ...s3EndpointInput,
        endpointUrl: 'https://babychain-media.s3.us-east-1.amazonaws.com',
      }),
    ).toEqual({
      clientEndpoint: 'https://s3.us-east-1.amazonaws.com',
      publicBaseUrl: 'https://babychain-media.s3.us-east-1.amazonaws.com',
    });
  });

  it('supports AWS S3 path-style bucket URLs', () => {
    expect(
      resolveAwsS3EndpointConfig({
        ...s3EndpointInput,
        endpointUrl: 'https://s3.us-east-1.amazonaws.com/babychain-media',
      }),
    ).toEqual({
      clientEndpoint: 'https://s3.us-east-1.amazonaws.com',
      publicBaseUrl: 'https://s3.us-east-1.amazonaws.com/babychain-media',
    });
  });

  it('derives an AWS S3 bucket public URL from a service endpoint', () => {
    expect(
      resolveAwsS3EndpointConfig({
        ...s3EndpointInput,
        endpointUrl: 'https://s3.us-east-1.amazonaws.com',
      }),
    ).toEqual({
      clientEndpoint: 'https://s3.us-east-1.amazonaws.com',
      publicBaseUrl: 'https://babychain-media.s3.us-east-1.amazonaws.com',
    });
  });

  it('uses custom AWS S3 endpoint URLs as public URLs and regional S3 for SDK writes', () => {
    expect(
      resolveAwsS3EndpointConfig({
        ...s3EndpointInput,
        endpointUrl: 'https://media.example.com',
      }),
    ).toEqual({
      clientEndpoint: 'https://s3.us-east-1.amazonaws.com',
      publicBaseUrl: 'https://media.example.com',
    });
  });

  it('rejects mismatched AWS S3 endpoint bucket paths', () => {
    expect(() =>
      resolveAwsS3EndpointConfig({
        ...s3EndpointInput,
        endpointUrl: 'https://s3.us-east-1.amazonaws.com/other-bucket',
      }),
    ).toThrow('AWS_S3_ENDPOINT_URL bucket path must match AWS_S3_BUCKET_NAME.');
  });

  it('stores data URL outputs through the selected provider', async () => {
    const writes: Parameters<StorageProvider['store']>[0][] = [];
    const provider: StorageProvider = {
      id: 'vercel-blob',
      label: 'test blob',
      store: async (input) => {
        writes.push(input);

        return {
          publicUrl: `https://blob.example.com/${input.key}`,
          storagePath: input.key,
        };
      },
    };

    const result = await persistOutputFiles({
      outputFiles: ['data:image/png;base64,aW1hZ2U='],
      provider,
      runId: 'run_123',
      stepKey: 'image',
    });

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      contentType: 'image/png',
      key: 'runs/run_123/image/output-0.png',
    });
    expect(Buffer.from(writes[0]!.data).toString('utf8')).toBe('image');
    expect(result.outputFiles).toEqual([
      'https://blob.example.com/runs/run_123/image/output-0.png',
    ]);
    expect(result.storageMetadata).toMatchObject({
      provider: 'vercel-blob',
      assets: [
        {
          byte_length: 5,
          content_type: 'image/png',
          output_index: 0,
          provider: 'vercel-blob',
          storage_path: 'runs/run_123/image/output-0.png',
          url: 'https://blob.example.com/runs/run_123/image/output-0.png',
        },
      ],
    });
    expect(result.storageMetadata?.assets[0]?.original_url).toContain(
      '<inline',
    );
  });

  it('keeps original outputs when optional storage fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const provider: StorageProvider = {
      id: 'aws-s3',
      label: 'test s3',
      store: async () => {
        throw new Error('AccessDenied');
      },
    };
    const output = 'data:image/jpeg;base64,aW1hZ2U=';

    const result = await persistOutputFiles({
      outputFiles: [output],
      provider,
      runId: 'run_123',
      stepKey: 'image',
    });

    expect(result.outputFiles).toEqual([output]);
    expect(result.storageMetadata).toBeNull();
    warn.mockRestore();
  });
});
