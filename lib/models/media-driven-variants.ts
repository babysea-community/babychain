export type MediaDrivenVariantInputKind = 'image' | 'video';

export type MediaDrivenCallerMediaField =
  | 'generation_input_image_file'
  | 'generation_input_video_file';

export type MediaDrivenChainRole = 'video' | 'modify';

export type MediaDrivenModelVariant = {
  baseModelIdentifier: string;
  inputKind: MediaDrivenVariantInputKind;
  modelIdentifier: string;
  requiredCallerMediaField: MediaDrivenCallerMediaField;
  role: MediaDrivenChainRole;
};

const MEDIA_DRIVEN_BASE_MODEL_IDENTIFIERS = new Set([
  'runway/act-two',
  'wan/2.2-animate-mix',
  'wan/2.2-animate-move',
]);

const MEDIA_DRIVEN_MODEL_VARIANTS = [
  {
    baseModelIdentifier: 'runway/act-two',
    inputKind: 'image',
    modelIdentifier: 'runway/act-two-image',
    requiredCallerMediaField: 'generation_input_video_file',
    role: 'video',
  },
  {
    baseModelIdentifier: 'runway/act-two',
    inputKind: 'video',
    modelIdentifier: 'runway/act-two-video',
    requiredCallerMediaField: 'generation_input_video_file',
    role: 'modify',
  },
  {
    baseModelIdentifier: 'wan/2.2-animate-mix',
    inputKind: 'image',
    modelIdentifier: 'wan/2.2-animate-mix-image',
    requiredCallerMediaField: 'generation_input_video_file',
    role: 'video',
  },
  {
    baseModelIdentifier: 'wan/2.2-animate-mix',
    inputKind: 'video',
    modelIdentifier: 'wan/2.2-animate-mix-video',
    requiredCallerMediaField: 'generation_input_image_file',
    role: 'modify',
  },
  {
    baseModelIdentifier: 'wan/2.2-animate-move',
    inputKind: 'image',
    modelIdentifier: 'wan/2.2-animate-move-image',
    requiredCallerMediaField: 'generation_input_video_file',
    role: 'video',
  },
  {
    baseModelIdentifier: 'wan/2.2-animate-move',
    inputKind: 'video',
    modelIdentifier: 'wan/2.2-animate-move-video',
    requiredCallerMediaField: 'generation_input_image_file',
    role: 'modify',
  },
] as const satisfies readonly MediaDrivenModelVariant[];

const MEDIA_DRIVEN_MODEL_VARIANT_BY_IDENTIFIER: ReadonlyMap<
  string,
  MediaDrivenModelVariant
> = new Map(
  MEDIA_DRIVEN_MODEL_VARIANTS.map((variant) => [
    variant.modelIdentifier,
    variant,
  ]),
);

export function listMediaDrivenModelVariants() {
  return [...MEDIA_DRIVEN_MODEL_VARIANTS];
}

export function isMediaDrivenBaseModelIdentifier(modelIdentifier: string) {
  return MEDIA_DRIVEN_BASE_MODEL_IDENTIFIERS.has(modelIdentifier);
}

export function getMediaDrivenModelVariant(modelIdentifier: string) {
  return MEDIA_DRIVEN_MODEL_VARIANT_BY_IDENTIFIER.get(modelIdentifier) ?? null;
}

export function resolveSemanticModelIdentifier(modelIdentifier: string) {
  return (
    getMediaDrivenModelVariant(modelIdentifier)?.baseModelIdentifier ??
    modelIdentifier
  );
}

export function getMediaDrivenRequiredCallerField(
  modelIdentifier: string,
  role: MediaDrivenChainRole,
): MediaDrivenCallerMediaField | null {
  const variant = getMediaDrivenModelVariant(modelIdentifier);

  if (variant) {
    return variant.role === role ? variant.requiredCallerMediaField : null;
  }

  return null;
}
