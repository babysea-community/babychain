import { Buffer } from 'node:buffer';

export type DataUrlOutputFile = {
  bytes: Buffer;
  mediaType: string;
};

const DEFAULT_DATA_URL_MEDIA_TYPE = 'text/plain;charset=US-ASCII';

export function serializeOutputFileReferences({
  files,
  runId,
  stepKey,
}: {
  files: readonly string[];
  runId: string;
  stepKey: string;
}) {
  return files.map((file, index) => {
    if (!isDataUrlOutputFile(file)) {
      return file;
    }

    return `/api/v1/chains/get/${runId}/outputs/${encodeURIComponent(stepKey)}/${index}`;
  });
}

export function isDataUrlOutputFile(value: string) {
  return splitDataUrl(value) !== null;
}

export function parseDataUrlOutputFile(
  value: string,
): DataUrlOutputFile | null {
  const parsed = splitDataUrl(value);

  if (!parsed) {
    return null;
  }

  const { data, isBase64, mediaType } = parsed;

  return {
    bytes: isBase64
      ? Buffer.from(data.replace(/\s/g, ''), 'base64')
      : Buffer.from(decodeURIComponent(data), 'utf8'),
    mediaType,
  };
}

export function createDataUrlOutputResponse(value: string) {
  const dataUrl = parseDataUrlOutputFile(value);

  if (!dataUrl) {
    return null;
  }

  const bytes = Uint8Array.from(dataUrl.bytes);

  return new Response(bytes, {
    headers: {
      'cache-control': 'no-store',
      'content-length': String(bytes.byteLength),
      'content-type': dataUrl.mediaType,
      'x-content-type-options': 'nosniff',
    },
  });
}

function splitDataUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed.toLowerCase().startsWith('data:')) {
    return null;
  }

  const dataStart = trimmed.indexOf(',');

  if (dataStart < 0) {
    return null;
  }

  const metadata = trimmed.slice('data:'.length, dataStart);
  const data = trimmed.slice(dataStart + 1);
  const metadataParts = metadata.split(';').filter(Boolean);
  const isBase64 = metadataParts.some(
    (part) => part.toLowerCase() === 'base64',
  );
  const mediaTypeParts = metadataParts.filter(
    (part) => part.toLowerCase() !== 'base64',
  );
  const mediaType =
    mediaTypeParts.length > 0
      ? mediaTypeParts.join(';')
      : DEFAULT_DATA_URL_MEDIA_TYPE;

  return { data, isBase64, mediaType };
}
