import 'server-only';

import { Buffer } from 'node:buffer';
import type { LookupAddress } from 'node:dns';
import type { IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { extname } from 'node:path';

import { parseDataUrlOutputFile } from '@/lib/chains/output-files';
import { lookupAllowedNetworkAddress } from '@/lib/security/network-safety';

import { createAwsS3StorageProvider } from './aws-s3';
import { createVercelBlobStorageProvider } from './vercel-blob';
import type { BabyChainStorageProviderId, StorageProvider } from './types';

export type { BabyChainStorageProviderId, StorageProvider } from './types';

const MAX_OUTPUT_STORAGE_BYTES = 200 * 1024 * 1024;
const OUTPUT_FETCH_TIMEOUT_MS = 60_000;

export type PersistOutputFilesResult = {
  outputFiles: string[];
  storageMetadata: {
    assets: Array<{
      byte_length: number;
      content_type: string;
      original_url: string;
      output_index: number;
      provider: BabyChainStorageProviderId;
      storage_path: string;
      url: string;
    }>;
    provider: BabyChainStorageProviderId;
  } | null;
};

export async function persistOutputFiles(input: {
  outputFiles: string[];
  provider?: StorageProvider | null;
  runId: string;
  stepKey: string;
}): Promise<PersistOutputFilesResult> {
  const provider = resolveProviderForPersistence(input);

  if (!provider || input.outputFiles.length === 0) {
    return { outputFiles: input.outputFiles, storageMetadata: null };
  }

  const outputFiles: string[] = [];
  const assets: NonNullable<
    PersistOutputFilesResult['storageMetadata']
  >['assets'] = [];

  for (const [index, outputFile] of input.outputFiles.entries()) {
    try {
      const media = await readOutputMedia(outputFile);
      const extension = extensionForContentType(media.contentType, outputFile);
      const key = `runs/${input.runId}/${input.stepKey}/output-${index}.${extension}`;
      const stored = await provider.store({
        contentType: media.contentType,
        data: media.bytes,
        key,
      });
      const url = stored.publicUrl ?? outputFile;

      outputFiles.push(url);
      assets.push({
        byte_length: media.bytes.byteLength,
        content_type: media.contentType,
        original_url: safeStorageOriginalReference(outputFile),
        output_index: index,
        provider: provider.id,
        storage_path: stored.storagePath,
        url,
      });
    } catch (error) {
      console.warn('[babychain] output storage failed; using original output', {
        error: error instanceof Error ? error.message : String(error),
        index,
        provider: provider.id,
        stepKey: input.stepKey,
      });
      outputFiles.push(outputFile);
    }
  }

  return {
    outputFiles,
    storageMetadata:
      assets.length > 0 ? { assets, provider: provider.id } : null,
  };
}

function resolveProviderForPersistence(input: {
  provider?: StorageProvider | null;
  outputFiles: string[];
}) {
  if ('provider' in input) {
    return input.provider ?? null;
  }

  try {
    return resolveOutputStorageProvider();
  } catch (error) {
    console.warn('[babychain] output storage unavailable; using originals', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function resolveOutputStorageProvider(): StorageProvider | null {
  const provider = process.env.BABYCHAIN_STORAGE_PROVIDER?.trim() || 'none';

  switch (provider) {
    case 'none':
      return null;
    case 'vercel-blob':
      return createVercelBlobStorageProvider();
    case 'aws-s3':
      return createAwsS3StorageProvider();
    default:
      throw new Error(
        'BABYCHAIN_STORAGE_PROVIDER must be none, vercel-blob, or aws-s3.',
      );
  }
}

async function readOutputMedia(value: string) {
  const dataUrl = parseDataUrlOutputFile(value);

  if (dataUrl) {
    assertByteLimit(dataUrl.bytes.byteLength);
    return {
      bytes: Uint8Array.from(dataUrl.bytes),
      contentType: dataUrl.mediaType,
    };
  }

  const parsed = parseHttpsOutputUrl(value);
  const resolved = await lookupAllowedNetworkAddress(parsed.hostname);

  if (!resolved) {
    throw new Error('Output URL resolves to a blocked address.');
  }

  return downloadOutputMedia(parsed, resolved);
}

function parseHttpsOutputUrl(value: string) {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Output URL must be a data URL or HTTPS URL.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Output URL must use HTTPS.');
  }

  return parsed;
}

function downloadOutputMedia(parsed: URL, resolved: LookupAddress) {
  return new Promise<{ bytes: Uint8Array; contentType: string }>(
    (resolve, reject) => {
      const request = httpsRequest(
        parsed,
        {
          headers: { accept: 'image/*,video/*' },
          lookup: (_hostname, options, callback) => {
            if (typeof options === 'object' && options.all) {
              const allCallback = callback as unknown as (
                error: NodeJS.ErrnoException | null,
                addresses: LookupAddress[],
              ) => void;

              allCallback(null, [resolved]);
              return;
            }

            callback(null, resolved.address, resolved.family);
          },
          method: 'GET',
        },
        (response) => {
          void readOutputResponse(response, parsed.pathname)
            .then(resolve)
            .catch(reject);
        },
      );
      const timeout = setTimeout(() => {
        request.destroy(new Error('Output download timed out.'));
      }, OUTPUT_FETCH_TIMEOUT_MS);

      request.on('error', reject);
      request.on('close', () => clearTimeout(timeout));
      request.end();
    },
  );
}

async function readOutputResponse(response: IncomingMessage, pathname: string) {
  const status = response.statusCode ?? 0;

  if (status < 200 || status >= 300) {
    throw new Error(`Output download failed with status ${status}.`);
  }

  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of response) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    assertByteLimit(total);
    chunks.push(buffer);
  }

  const contentType = normalizeContentType(
    response.headers['content-type'],
    pathname,
  );

  return {
    bytes: Uint8Array.from(Buffer.concat(chunks)),
    contentType,
  };
}

function normalizeContentType(
  value: string | string[] | undefined,
  path: string,
) {
  const raw = Array.isArray(value) ? value[0] : value;
  const contentType = raw?.split(';')[0]?.trim().toLowerCase();

  if (contentType?.startsWith('image/') || contentType?.startsWith('video/')) {
    return contentType;
  }

  const extension = extname(path).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.gif') return 'image/gif';
  if (extension === '.mp4') return 'video/mp4';
  if (extension === '.webm') return 'video/webm';

  return 'application/octet-stream';
}

function extensionForContentType(contentType: string, source: string) {
  const normalized = contentType.toLowerCase();
  if (normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/gif') return 'gif';
  if (normalized === 'video/mp4') return 'mp4';
  if (normalized === 'video/webm') return 'webm';

  const extension = extname(source).replace(/^\./, '').toLowerCase();
  return extension || 'bin';
}

function assertByteLimit(byteLength: number) {
  if (byteLength > MAX_OUTPUT_STORAGE_BYTES) {
    throw new Error('Output media is larger than BabyChain storage limit.');
  }
}

function safeStorageOriginalReference(value: string) {
  if (!value.trim().toLowerCase().startsWith('data:')) {
    return value;
  }

  const commaIndex = value.indexOf(',');
  const header = commaIndex >= 0 ? value.slice(0, commaIndex) : 'data:';
  return `${header},<inline ${value.length} chars>`;
}
