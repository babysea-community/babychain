import 'server-only';

export type ModelProvider =
  | 'alibaba-cloud'
  | 'black-forest-labs'
  | 'byteplus'
  | 'google'
  | 'openai'
  | 'runway';
export type ModelKind = 'image' | 'video';
export type ModelMode = 'babysea' | 'byok';

export type JsonSchemaObject = Record<string, unknown>;

export type ModelRawSchema = {
  endpoint: string;
  method: 'POST';
  provider: ModelProvider;
  request: JsonSchemaObject;
  response: JsonSchemaObject;
  notes?: string[];
};

export type ModelCatalogEntry = {
  babychainConstraints?: JsonSchemaObject;
  babyseaCompatible?: boolean;
  key: string;
  kind: ModelKind;
  modelIdentifier: string;
  provider: ModelProvider;
  rawId: string;
  rawSchema: ModelRawSchema;
};

const outputFormat = {
  type: ['string', 'null'],
  enum: ['jpeg', 'png', 'webp', null],
  default: 'jpeg',
  description: 'Generated image format.',
};

// ----------------------------
// Alibaba Cloud
// ----------------------------

const alibabaCloudRegionNotes = [
  'Set DASHSCOPE_API_KEY on the BabyChain server for BYOK mode.',
  'BabyChain uses the Singapore DashScope endpoint for Alibaba Cloud BYOK calls.',
];

const alibabaCloudMultimodalContentItem = {
  oneOf: [
    {
      type: 'object',
      required: ['text'],
      properties: { text: { type: 'string' } },
    },
    {
      type: 'object',
      required: ['image'],
      properties: { image: { type: 'string', format: 'uri' } },
    },
  ],
};

const alibabaCloudMultimodalMessageInput = {
  type: 'object',
  required: ['messages'],
  properties: {
    messages: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['role', 'content'],
        properties: {
          role: { type: 'string', enum: ['user'] },
          content: {
            type: 'array',
            minItems: 1,
            items: alibabaCloudMultimodalContentItem,
          },
        },
      },
    },
  },
};

const alibabaCloudCommonImageParameters = {
  negative_prompt: { type: 'string', maxLength: 500 },
  size: { type: 'string', examples: ['1024*1024', '1280*720'] },
  n: { type: 'integer', minimum: 1 },
  seed: { type: 'integer', minimum: 0, maximum: 2_147_483_647 },
  watermark: { type: 'boolean' },
  prompt_extend: { type: 'boolean' },
};

function createAlibabaCloudMultimodalImageRequest(
  parameters: Record<string, unknown>,
): JsonSchemaObject {
  return {
    type: 'object',
    required: ['model', 'input'],
    properties: {
      model: { type: 'string' },
      input: alibabaCloudMultimodalMessageInput,
      parameters: {
        type: 'object',
        properties: parameters,
      },
    },
  };
}

const alibabaCloudMultimodalImageRequest =
  createAlibabaCloudMultimodalImageRequest(alibabaCloudCommonImageParameters);

const alibabaCloudZImageRequest = createAlibabaCloudMultimodalImageRequest({
  size: { type: 'string', examples: ['1024*1024'] },
  seed: alibabaCloudCommonImageParameters.seed,
  prompt_extend: alibabaCloudCommonImageParameters.prompt_extend,
});

const alibabaCloudWan27ImageRequest = createAlibabaCloudMultimodalImageRequest({
  bbox_list: {
    type: 'array',
    items: {
      type: 'array',
      items: {
        type: 'array',
        minItems: 4,
        maxItems: 4,
        items: { type: 'integer' },
      },
    },
  },
  enable_sequential: { type: 'boolean', default: false },
  size: { type: 'string', examples: ['1K', '2K', '4K', '2048*2048'] },
  n: { type: 'integer', minimum: 1, maximum: 12 },
  watermark: alibabaCloudCommonImageParameters.watermark,
  thinking_mode: { type: 'boolean', default: true },
  color_palette: {
    type: 'array',
    minItems: 3,
    maxItems: 10,
    items: {
      type: 'object',
      required: ['hex', 'ratio'],
      properties: {
        hex: { type: 'string' },
        ratio: { type: 'string' },
      },
    },
  },
});

const alibabaCloudWan26ImageRequest = createAlibabaCloudMultimodalImageRequest({
  negative_prompt: alibabaCloudCommonImageParameters.negative_prompt,
  size: { type: 'string', examples: ['1K', '2K', '1280*1280'] },
  enable_interleave: { type: 'boolean', default: false },
  stream: { type: 'boolean', default: false },
  max_images: { type: 'integer', minimum: 1, maximum: 5, default: 5 },
  n: { type: 'integer', minimum: 1, maximum: 4 },
  prompt_extend: alibabaCloudCommonImageParameters.prompt_extend,
  watermark: alibabaCloudCommonImageParameters.watermark,
  seed: alibabaCloudCommonImageParameters.seed,
});

const alibabaCloudWan25ImageToImageRequest = {
  type: 'object',
  required: ['model', 'input'],
  properties: {
    model: { type: 'string' },
    input: {
      type: 'object',
      required: ['prompt', 'images'],
      properties: {
        prompt: { type: 'string', maxLength: 800 },
        negative_prompt: { type: 'string', maxLength: 500 },
        images: {
          type: 'array',
          minItems: 1,
          items: { type: 'string' },
        },
      },
    },
    parameters: {
      type: 'object',
      properties: {
        size: { type: 'string', examples: ['1024*1024', '1280*720'] },
        n: { type: 'integer', minimum: 1 },
        watermark: { type: 'boolean' },
        prompt_extend: { type: 'boolean' },
        seed: alibabaCloudCommonImageParameters.seed,
      },
    },
  },
};

const alibabaCloudWanx21ImageEditRequest = {
  type: 'object',
  required: ['model', 'input'],
  properties: {
    model: { type: 'string' },
    input: {
      type: 'object',
      required: ['function', 'prompt', 'base_image_url'],
      properties: {
        function: {
          type: 'string',
          enum: [
            'stylization_all',
            'stylization_local',
            'description_edit',
            'description_edit_with_mask',
            'remove_watermark',
            'expand',
            'super_resolution',
            'colorization',
            'doodle',
            'control_cartoon_feature',
          ],
        },
        prompt: { type: 'string', maxLength: 800 },
        base_image_url: { type: 'string' },
        mask_image_url: { type: 'string' },
      },
    },
    parameters: {
      type: 'object',
      properties: {
        n: { type: 'integer', minimum: 1, maximum: 4, default: 1 },
        seed: alibabaCloudCommonImageParameters.seed,
        watermark: { type: 'boolean' },
        strength: { type: 'number', minimum: 0, maximum: 1, default: 0.5 },
        top_scale: { type: 'number', minimum: 1, maximum: 2, default: 1 },
        bottom_scale: { type: 'number', minimum: 1, maximum: 2, default: 1 },
        left_scale: { type: 'number', minimum: 1, maximum: 2, default: 1 },
        right_scale: { type: 'number', minimum: 1, maximum: 2, default: 1 },
        upscale_factor: { type: 'integer', minimum: 1, maximum: 4, default: 1 },
        is_sketch: { type: 'boolean', default: false },
      },
    },
  },
};

const alibabaCloudVideoParameters = {
  resolution: { type: 'string', examples: ['480P', '720P', '1080P'] },
  size: { type: 'string', examples: ['1280*720', '720*1280'] },
  ratio: { type: 'string', examples: ['16:9', '9:16', '1:1'] },
  seed: alibabaCloudCommonImageParameters.seed,
  prompt_extend: { type: 'boolean' },
  watermark: { type: 'boolean' },
  audio_setting: { type: 'string', enum: ['auto', 'origin'] },
  shot_type: { type: 'string', enum: ['single', 'multi'] },
};

const alibabaCloudHappyHorseVideoDurationParameter = {
  type: 'integer',
  minimum: 3,
  maximum: 15,
  default: 5,
};

const alibabaCloudWan27VideoDurationParameter = {
  type: 'integer',
  minimum: 2,
  maximum: 15,
  default: 5,
};

const alibabaCloudWan27ReferenceVideoDurationParameter = {
  type: 'integer',
  minimum: 3,
  maximum: 15,
  default: 5,
};

const alibabaCloudWan27VideoEditDurationParameter = {
  anyOf: [{ const: 0 }, { type: 'integer', minimum: 2, maximum: 10 }],
  default: 0,
};

function createAlibabaCloudVideoRequest(args: {
  allowAudioUrl?: boolean;
  allowNegativePrompt?: boolean;
  mediaTypes?: string[];
  parameterProperties: Record<string, unknown>;
  requiredInput?: string[];
}): JsonSchemaObject {
  const inputProperties: Record<string, unknown> = {
    prompt: { type: 'string' },
  };

  if (args.allowNegativePrompt) {
    inputProperties.negative_prompt = { type: 'string', maxLength: 500 };
  }

  if (args.allowAudioUrl) {
    inputProperties.audio_url = { type: 'string' };
  }

  if (args.mediaTypes) {
    inputProperties.media = {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['type', 'url'],
        properties: {
          type: { type: 'string', enum: args.mediaTypes },
          url: { type: 'string' },
          reference_voice: { type: 'string' },
        },
      },
    };
  }

  return {
    type: 'object',
    required: ['model', 'input'],
    properties: {
      model: { type: 'string' },
      input: {
        type: 'object',
        required: args.requiredInput ?? ['prompt'],
        properties: inputProperties,
      },
      parameters: {
        type: 'object',
        properties: args.parameterProperties,
      },
    },
  };
}

const alibabaCloudHappyHorseTextToVideoRequest = createAlibabaCloudVideoRequest(
  {
    parameterProperties: {
      resolution: alibabaCloudVideoParameters.resolution,
      ratio: alibabaCloudVideoParameters.ratio,
      duration: alibabaCloudHappyHorseVideoDurationParameter,
      watermark: alibabaCloudVideoParameters.watermark,
      seed: alibabaCloudVideoParameters.seed,
    },
  },
);

const alibabaCloudHappyHorseImageToVideoRequest =
  createAlibabaCloudVideoRequest({
    mediaTypes: ['first_frame'],
    requiredInput: ['media'],
    parameterProperties: {
      resolution: alibabaCloudVideoParameters.resolution,
      duration: alibabaCloudHappyHorseVideoDurationParameter,
      watermark: alibabaCloudVideoParameters.watermark,
      seed: alibabaCloudVideoParameters.seed,
    },
  });

const alibabaCloudHappyHorseReferenceToVideoRequest =
  createAlibabaCloudVideoRequest({
    mediaTypes: ['reference_image'],
    requiredInput: ['prompt', 'media'],
    parameterProperties: {
      resolution: alibabaCloudVideoParameters.resolution,
      ratio: alibabaCloudVideoParameters.ratio,
      duration: alibabaCloudHappyHorseVideoDurationParameter,
      watermark: alibabaCloudVideoParameters.watermark,
      seed: alibabaCloudVideoParameters.seed,
    },
  });

const alibabaCloudHappyHorseVideoEditRequest = createAlibabaCloudVideoRequest({
  mediaTypes: ['video', 'reference_image'],
  requiredInput: ['prompt', 'media'],
  parameterProperties: {
    resolution: alibabaCloudVideoParameters.resolution,
    watermark: alibabaCloudVideoParameters.watermark,
    audio_setting: alibabaCloudVideoParameters.audio_setting,
    seed: alibabaCloudVideoParameters.seed,
  },
});

const alibabaCloudWan27TextToVideoRequest = createAlibabaCloudVideoRequest({
  allowAudioUrl: true,
  allowNegativePrompt: true,
  parameterProperties: {
    resolution: alibabaCloudVideoParameters.resolution,
    ratio: alibabaCloudVideoParameters.ratio,
    duration: alibabaCloudWan27VideoDurationParameter,
    prompt_extend: alibabaCloudVideoParameters.prompt_extend,
    watermark: alibabaCloudVideoParameters.watermark,
    seed: alibabaCloudVideoParameters.seed,
  },
});

const alibabaCloudWan27ImageToVideoRequest = createAlibabaCloudVideoRequest({
  allowNegativePrompt: true,
  mediaTypes: ['first_frame', 'last_frame', 'driving_audio', 'first_clip'],
  requiredInput: ['media'],
  parameterProperties: {
    resolution: alibabaCloudVideoParameters.resolution,
    duration: alibabaCloudWan27VideoDurationParameter,
    prompt_extend: alibabaCloudVideoParameters.prompt_extend,
    watermark: alibabaCloudVideoParameters.watermark,
    seed: alibabaCloudVideoParameters.seed,
  },
});

const alibabaCloudWan27ReferenceToVideoRequest = createAlibabaCloudVideoRequest(
  {
    allowNegativePrompt: true,
    mediaTypes: ['reference_image', 'reference_video', 'first_frame'],
    requiredInput: ['prompt', 'media'],
    parameterProperties: {
      resolution: alibabaCloudVideoParameters.resolution,
      ratio: alibabaCloudVideoParameters.ratio,
      duration: alibabaCloudWan27ReferenceVideoDurationParameter,
      prompt_extend: alibabaCloudVideoParameters.prompt_extend,
      watermark: alibabaCloudVideoParameters.watermark,
      seed: alibabaCloudVideoParameters.seed,
    },
  },
);

const alibabaCloudWan27VideoEditRequest = createAlibabaCloudVideoRequest({
  allowNegativePrompt: true,
  mediaTypes: ['video', 'reference_image'],
  requiredInput: ['media'],
  parameterProperties: {
    resolution: alibabaCloudVideoParameters.resolution,
    ratio: alibabaCloudVideoParameters.ratio,
    duration: alibabaCloudWan27VideoEditDurationParameter,
    audio_setting: alibabaCloudVideoParameters.audio_setting,
    prompt_extend: alibabaCloudVideoParameters.prompt_extend,
    watermark: alibabaCloudVideoParameters.watermark,
    seed: alibabaCloudVideoParameters.seed,
  },
});

const alibabaCloudImageToVideoRequest = {
  type: 'object',
  required: ['model', 'input', 'parameters'],
  properties: {
    model: { type: 'string' },
    input: {
      type: 'object',
      required: ['image_url', 'video_url'],
      properties: {
        image_url: { type: 'string', format: 'uri' },
        video_url: { type: 'string', format: 'uri' },
        watermark: { type: 'boolean' },
      },
    },
    parameters: {
      type: 'object',
      required: ['mode'],
      properties: {
        check_image: { type: 'boolean' },
        mode: { type: 'string', enum: ['wan-std', 'wan-pro'] },
      },
    },
  },
};

const alibabaCloudSyncResponse = {
  type: 'object',
  properties: {
    request_id: { type: 'string' },
    output: {
      type: 'object',
      properties: {
        choices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              message: {
                type: 'object',
                properties: {
                  content: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: { type: 'string' },
                        image: { type: 'string', format: 'uri' },
                        text: { type: 'string' },
                        reasoning_content: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    usage: { type: 'object' },
  },
};

const alibabaCloudTaskResponse = {
  type: 'object',
  properties: {
    request_id: { type: 'string' },
    output: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        task_status: {
          type: 'string',
          enum: [
            'PENDING',
            'RUNNING',
            'SUCCEEDED',
            'FAILED',
            'CANCELED',
            'UNKNOWN',
          ],
        },
        image_url: { type: 'string', format: 'uri' },
        video_url: { type: 'string', format: 'uri' },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string', format: 'uri' },
              image_url: { type: 'string', format: 'uri' },
              video_url: { type: 'string', format: 'uri' },
            },
          },
        },
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    usage: { type: 'object' },
  },
};

const ALIBABA_CLOUD_SYNC_IMAGE_MODELS = [
  'qwen-image-2.0-pro',
  'qwen-image-2.0',
  'qwen-image-max',
  'qwen-image-plus',
  'qwen-image',
  'qwen-image-edit-max',
  'qwen-image-edit-plus',
  'qwen-image-edit',
  'z-image-turbo',
  'wan2.7-image-pro',
  'wan2.7-image',
  'wan2.6-image',
  'wan2.6-t2i',
] as const;

const ALIBABA_CLOUD_ASYNC_IMAGE_TO_IMAGE_MODELS = [
  'wan2.5-i2i-preview',
  'wanx2.1-imageedit',
] as const;

const ALIBABA_CLOUD_VIDEO_MODELS = [
  'happyhorse-1.0-t2v',
  'happyhorse-1.0-i2v',
  'happyhorse-1.0-r2v',
  'happyhorse-1.0-video-edit',
  'wan2.7-t2v',
  'wan2.7-i2v-2026-04-25',
  'wan2.7-r2v',
  'wan2.7-videoedit',
  'wan2.2-animate-mix',
  'wan2.2-animate-move',
] as const;

const ALIBABA_CLOUD_ANIMATE_VIDEO_MODELS = [
  'wan2.2-animate-mix',
  'wan2.2-animate-move',
] as const;

function alibabaCloudSyncImageSchema(
  request: JsonSchemaObject,
): ModelRawSchema {
  return {
    provider: 'alibaba-cloud',
    method: 'POST',
    endpoint:
      'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    request,
    response: alibabaCloudSyncResponse,
    notes: alibabaCloudRegionNotes,
  };
}

function alibabaCloudAsyncImageSchema(
  endpoint: 'image2image/image-synthesis',
  request: JsonSchemaObject,
): ModelRawSchema {
  return {
    provider: 'alibaba-cloud',
    method: 'POST',
    endpoint: `https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/${endpoint}`,
    request,
    response: alibabaCloudTaskResponse,
    notes: [
      ...alibabaCloudRegionNotes,
      'Send X-DashScope-Async: enable when submitting. Poll GET /api/v1/tasks/{task_id}.',
    ],
  };
}

function alibabaCloudVideoSchema(request: JsonSchemaObject): ModelRawSchema {
  return {
    provider: 'alibaba-cloud',
    method: 'POST',
    endpoint:
      'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
    request,
    response: alibabaCloudTaskResponse,
    notes: [
      ...alibabaCloudRegionNotes,
      'Send X-DashScope-Async: enable when submitting. Poll GET /api/v1/tasks/{task_id}.',
    ],
  };
}

function alibabaCloudImageToVideoSchema(
  request: JsonSchemaObject,
): ModelRawSchema {
  return {
    provider: 'alibaba-cloud',
    method: 'POST',
    endpoint:
      'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis',
    request,
    response: alibabaCloudTaskResponse,
    notes: [
      ...alibabaCloudRegionNotes,
      'Send X-DashScope-Async: enable when submitting. Poll GET /api/v1/tasks/{task_id}.',
    ],
  };
}

function isAlibabaCloudAnimateVideoModel(rawId: string) {
  return (ALIBABA_CLOUD_ANIMATE_VIDEO_MODELS as readonly string[]).includes(
    rawId,
  );
}

function alibabaCloudEntry(args: {
  babyseaCompatible?: boolean;
  kind: ModelKind;
  modelIdentifier?: string;
  rawId: string;
  rawSchema: ModelRawSchema;
}): ModelCatalogEntry {
  return {
    key: `ALIBABACLOUD_${args.rawId.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`,
    modelIdentifier:
      args.modelIdentifier ?? alibabaCloudModelIdentifier(args.rawId),
    kind: args.kind,
    provider: 'alibaba-cloud',
    rawId: args.rawId,
    ...(args.babyseaCompatible === false ? { babyseaCompatible: false } : {}),
    rawSchema: args.rawSchema,
  };
}

function alibabaCloudModelIdentifier(rawId: string) {
  const explicitNames: Record<string, string> = {
    'qwen-image-2.0-pro': 'qwen/image-2-pro',
    'qwen-image-2.0': 'qwen/image-2',
    'qwen-image-max': 'qwen/image-max',
    'qwen-image-plus': 'qwen/image',
    'qwen-image': 'qwen/image-base',
    'qwen-image-edit-max': 'qwen/image-edit-max',
    'qwen-image-edit-plus': 'qwen/image-edit-plus',
    'qwen-image-edit': 'qwen/image-edit',
    'z-image-turbo': 'z/image-turbo',
  };

  const explicitName = explicitNames[rawId];
  if (explicitName) {
    return explicitName;
  }

  if (rawId.startsWith('wan2.')) {
    return `wan/${rawId.slice('wan'.length)}`;
  }

  if (rawId.startsWith('wanx2.')) {
    return `wan/${rawId.slice('wanx'.length)}`;
  }

  if (rawId.startsWith('happyhorse-')) {
    return `happyhorse/${rawId.slice('happyhorse-'.length)}`;
  }

  throw new Error(
    `Missing BabyChain public model identifier mapping for Alibaba Cloud raw model "${rawId}".`,
  );
}

function alibabaCloudSyncImageRequestFor(rawId: string) {
  if (rawId === 'z-image-turbo') {
    return alibabaCloudZImageRequest;
  }

  if (rawId === 'wan2.7-image-pro' || rawId === 'wan2.7-image') {
    return alibabaCloudWan27ImageRequest;
  }

  if (rawId === 'wan2.6-image') {
    return alibabaCloudWan26ImageRequest;
  }

  return alibabaCloudMultimodalImageRequest;
}

function alibabaCloudAsyncImageRequestFor(rawId: string) {
  if (rawId === 'wanx2.1-imageedit') {
    return alibabaCloudWanx21ImageEditRequest;
  }

  return alibabaCloudWan25ImageToImageRequest;
}

function alibabaCloudVideoRawSchemaFor(rawId: string) {
  if (isAlibabaCloudAnimateVideoModel(rawId)) {
    return alibabaCloudImageToVideoSchema(alibabaCloudImageToVideoRequest);
  }

  switch (rawId) {
    case 'happyhorse-1.0-t2v':
      return alibabaCloudVideoSchema(alibabaCloudHappyHorseTextToVideoRequest);
    case 'happyhorse-1.0-i2v':
      return alibabaCloudVideoSchema(alibabaCloudHappyHorseImageToVideoRequest);
    case 'happyhorse-1.0-r2v':
      return alibabaCloudVideoSchema(
        alibabaCloudHappyHorseReferenceToVideoRequest,
      );
    case 'happyhorse-1.0-video-edit':
      return alibabaCloudVideoSchema(alibabaCloudHappyHorseVideoEditRequest);
    case 'wan2.7-t2v':
      return alibabaCloudVideoSchema(alibabaCloudWan27TextToVideoRequest);
    case 'wan2.7-i2v-2026-04-25':
      return alibabaCloudVideoSchema(alibabaCloudWan27ImageToVideoRequest);
    case 'wan2.7-r2v':
      return alibabaCloudVideoSchema(alibabaCloudWan27ReferenceToVideoRequest);
    case 'wan2.7-videoedit':
      return alibabaCloudVideoSchema(alibabaCloudWan27VideoEditRequest);
    default:
      throw new Error(
        `Missing Alibaba Cloud video request schema for raw model "${rawId}".`,
      );
  }
}

const alibabaCloudModelEntries = [
  ...ALIBABA_CLOUD_SYNC_IMAGE_MODELS.map((rawId) =>
    alibabaCloudEntry({
      rawId,
      babyseaCompatible: rawId === 'qwen-image-plus' ? undefined : false,
      kind: 'image',
      rawSchema: alibabaCloudSyncImageSchema(
        alibabaCloudSyncImageRequestFor(rawId),
      ),
    }),
  ),
  ...ALIBABA_CLOUD_ASYNC_IMAGE_TO_IMAGE_MODELS.map((rawId) =>
    alibabaCloudEntry({
      rawId,
      babyseaCompatible: false,
      kind: 'image',
      rawSchema: alibabaCloudAsyncImageSchema(
        'image2image/image-synthesis',
        alibabaCloudAsyncImageRequestFor(rawId),
      ),
    }),
  ),
  ...ALIBABA_CLOUD_VIDEO_MODELS.map((rawId) =>
    alibabaCloudEntry({
      rawId,
      babyseaCompatible: false,
      kind: 'video',
      rawSchema: alibabaCloudVideoRawSchemaFor(rawId),
    }),
  ),
] satisfies readonly ModelCatalogEntry[];

// ----------------------------
// Black Forest Labs
// ----------------------------

const bflAsyncResponse = {
  type: 'object',
  required: ['id', 'polling_url'],
  properties: {
    id: { type: 'string' },
    polling_url: { type: 'string' },
    cost: { type: ['number', 'null'] },
    input_mp: { type: ['number', 'null'] },
    output_mp: { type: ['number', 'null'] },
  },
};

const bflWebhookResponse = {
  type: 'object',
  required: ['id', 'status', 'webhook_url'],
  properties: {
    id: { type: 'string' },
    status: { type: 'string' },
    webhook_url: { type: 'string' },
    cost: { type: ['number', 'null'] },
    input_mp: { type: ['number', 'null'] },
    output_mp: { type: ['number', 'null'] },
  },
};

const bflImageInputProperties = Object.fromEntries(
  Array.from({ length: 8 }, (_, index) => {
    const ordinal = index + 1;
    return [
      ordinal === 1 ? 'input_image' : `input_image_${ordinal}`,
      {
        type: ['string', 'null'],
        description:
          ordinal === 1
            ? 'Path, URL, or encoded input image for editing.'
            : `Additional input image ${ordinal}.`,
      },
    ];
  }),
);

const bflKleinImageInputProperties = Object.fromEntries(
  Object.entries(bflImageInputProperties).slice(0, 4),
);

const bflFlux2Request = {
  type: 'object',
  required: ['prompt'],
  properties: {
    prompt: {
      type: 'string',
      minLength: 1,
      description: 'Text prompt for image generation or editing.',
    },
    ...bflImageInputProperties,
    seed: { type: ['integer', 'null'], description: 'Optional seed.' },
    width: { type: ['integer', 'null'], minimum: 64, default: 0 },
    height: { type: ['integer', 'null'], minimum: 64, default: 0 },
    safety_tolerance: { type: 'integer', minimum: 0, maximum: 5, default: 2 },
    output_format: outputFormat,
    webhook_url: { type: ['string', 'null'], format: 'uri' },
    webhook_secret: { type: ['string', 'null'] },
  },
};

const bflFlux2FlexRequest = {
  type: 'object',
  required: ['prompt'],
  properties: {
    prompt_upsampling: { type: ['boolean', 'null'], default: true },
    prompt: bflFlux2Request.properties.prompt,
    ...bflImageInputProperties,
    input_image_blob_path: { type: ['string', 'null'] },
    seed: bflFlux2Request.properties.seed,
    width: bflFlux2Request.properties.width,
    height: bflFlux2Request.properties.height,
    guidance: {
      type: ['number', 'null'],
      minimum: 1.5,
      maximum: 10,
      default: 5,
    },
    steps: { type: ['integer', 'null'], minimum: 1, maximum: 50, default: 50 },
    safety_tolerance: bflFlux2Request.properties.safety_tolerance,
    output_format: outputFormat,
    webhook_url: bflFlux2Request.properties.webhook_url,
    webhook_secret: bflFlux2Request.properties.webhook_secret,
  },
};

const bflFlux2KleinRequest = {
  type: 'object',
  required: ['prompt'],
  properties: {
    prompt: bflFlux2Request.properties.prompt,
    ...bflKleinImageInputProperties,
    seed: bflFlux2Request.properties.seed,
    width: bflFlux2Request.properties.width,
    height: bflFlux2Request.properties.height,
    safety_tolerance: bflFlux2Request.properties.safety_tolerance,
    output_format: outputFormat,
    webhook_url: bflFlux2Request.properties.webhook_url,
    webhook_secret: bflFlux2Request.properties.webhook_secret,
  },
};

const bflFlux11ProRequest = {
  type: 'object',
  properties: {
    prompt: { type: ['string', 'null'], default: '' },
    image_prompt: {
      type: ['string', 'null'],
      description: 'Optional base64 encoded image for Flux Redux.',
    },
    width: {
      type: 'integer',
      minimum: 256,
      maximum: 1440,
      multipleOf: 32,
      default: 1024,
    },
    height: {
      type: 'integer',
      minimum: 256,
      maximum: 1440,
      multipleOf: 32,
      default: 768,
    },
    prompt_upsampling: { type: 'boolean', default: false },
    seed: { type: ['integer', 'null'] },
    safety_tolerance: { type: 'integer', minimum: 0, maximum: 6, default: 2 },
    output_format: outputFormat,
    webhook_url: { type: ['string', 'null'], format: 'uri' },
    webhook_secret: { type: ['string', 'null'] },
  },
};

const bflFlux11UltraRequest = {
  type: 'object',
  properties: {
    prompt: { type: ['string', 'null'], default: '' },
    prompt_upsampling: { type: 'boolean', default: false },
    seed: { type: ['integer', 'null'] },
    aspect_ratio: { type: 'string', default: '16:9' },
    safety_tolerance: { type: 'integer', minimum: 0, maximum: 6, default: 2 },
    output_format: outputFormat,
    raw: { type: 'boolean', default: false },
    image_prompt: { type: ['string', 'null'] },
    image_prompt_strength: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      default: 0.1,
    },
    webhook_url: { type: ['string', 'null'], format: 'uri' },
    webhook_secret: { type: ['string', 'null'] },
  },
};

function bflSchema(
  endpoint: string,
  request: JsonSchemaObject,
): ModelRawSchema {
  return {
    provider: 'black-forest-labs',
    method: 'POST',
    endpoint: `https://api.bfl.ai/v1/${endpoint}`,
    request,
    response: { anyOf: [bflAsyncResponse, bflWebhookResponse] },
    notes: ['Use the returned polling_url verbatim for async polling.'],
  };
}

const bflModelEntries = [
  {
    key: 'BFL_FLUX_11_PRO',
    modelIdentifier: 'bfl/flux-1.1-pro',
    kind: 'image',
    provider: 'black-forest-labs',
    rawId: 'flux-pro-1.1',
    rawSchema: bflSchema('flux-pro-1.1', bflFlux11ProRequest),
  },
  {
    key: 'BFL_FLUX_11_PRO_ULTRA',
    modelIdentifier: 'bfl/flux-1.1-pro-ultra',
    kind: 'image',
    provider: 'black-forest-labs',
    rawId: 'flux-pro-1.1-ultra',
    rawSchema: bflSchema('flux-pro-1.1-ultra', bflFlux11UltraRequest),
  },
  {
    key: 'BFL_FLUX_2_KLEIN_4B',
    modelIdentifier: 'bfl/flux-2-klein-4b',
    kind: 'image',
    provider: 'black-forest-labs',
    rawId: 'flux-2-klein-4b',
    rawSchema: bflSchema('flux-2-klein-4b', bflFlux2KleinRequest),
  },
  {
    key: 'BFL_FLUX_2_KLEIN_9B',
    modelIdentifier: 'bfl/flux-2-klein-9b',
    kind: 'image',
    provider: 'black-forest-labs',
    rawId: 'flux-2-klein-9b',
    rawSchema: bflSchema('flux-2-klein-9b', bflFlux2KleinRequest),
  },
  {
    key: 'BFL_FLUX_2_FLEX',
    modelIdentifier: 'bfl/flux-2-flex',
    kind: 'image',
    provider: 'black-forest-labs',
    rawId: 'flux-2-flex',
    rawSchema: bflSchema('flux-2-flex', bflFlux2FlexRequest),
  },
  {
    key: 'BFL_FLUX_2_PRO',
    modelIdentifier: 'bfl/flux-2-pro',
    kind: 'image',
    provider: 'black-forest-labs',
    rawId: 'flux-2-pro',
    rawSchema: bflSchema('flux-2-pro', bflFlux2Request),
  },
  {
    key: 'BFL_FLUX_2_MAX',
    modelIdentifier: 'bfl/flux-2-max',
    kind: 'image',
    provider: 'black-forest-labs',
    rawId: 'flux-2-max',
    rawSchema: bflSchema('flux-2-max', bflFlux2Request),
  },
] satisfies readonly ModelCatalogEntry[];

// ----------------------------
// BytePlus
// ----------------------------

const byteplusImageBabyChainConstraints = {
  response_format: {
    const: 'url',
    reason:
      'BabyChain image steps return output_files URLs for downstream chaining.',
  },
};

const byteplusVideoBabyChainConstraints = {
  callback_url: {
    not_supported: true,
    reason:
      'BabyChain owns provider polling and delivers one terminal callback through the top-level webhook_url.',
  },
};

const byteplusImageResponse = {
  type: 'object',
  properties: {
    model: { type: 'string' },
    created: { type: 'integer' },
    data: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          b64_json: { type: 'string' },
          size: { type: 'string' },
          error: { type: 'object' },
        },
      },
    },
    usage: { type: 'object' },
    error: { type: 'object' },
  },
};

const byteplusSeedream4Request = {
  type: 'object',
  required: ['model', 'prompt'],
  properties: {
    model: { type: 'string' },
    prompt: { type: 'string' },
    image: {
      anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    },
    size: { type: 'string', default: '2048x2048' },
    sequential_image_generation: {
      type: 'string',
      enum: ['auto', 'disabled'],
      default: 'disabled',
    },
    sequential_image_generation_options: {
      type: 'object',
      properties: {
        max_images: { type: 'integer', minimum: 1, maximum: 15, default: 15 },
      },
    },
    stream: { type: 'boolean', default: false },
    response_format: {
      type: 'string',
      enum: ['url', 'b64_json'],
      default: 'url',
    },
    watermark: { type: 'boolean', default: true },
    optimize_prompt_options: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['standard', 'fast'],
          default: 'standard',
        },
      },
    },
  },
};

const byteplusSeedream45Request = {
  ...byteplusSeedream4Request,
  properties: {
    ...byteplusSeedream4Request.properties,
    optimize_prompt_options: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['standard'], default: 'standard' },
      },
    },
  },
};

const byteplusSeedream5LiteRequest = {
  ...byteplusSeedream45Request,
  properties: {
    ...byteplusSeedream45Request.properties,
    output_format: { type: 'string', enum: ['png', 'jpeg'], default: 'jpeg' },
  },
};

const byteplusSupportedFrameCounts = Array.from(
  { length: 66 },
  (_, index) => 29 + index * 4,
);

const byteplusContentItem = {
  oneOf: [
    {
      type: 'object',
      required: ['type', 'text'],
      properties: { type: { const: 'text' }, text: { type: 'string' } },
    },
    {
      type: 'object',
      required: ['type', 'image_url'],
      properties: {
        type: { const: 'image_url' },
        image_url: {
          type: 'object',
          required: ['url'],
          properties: { url: { type: 'string' } },
        },
        role: {
          type: 'string',
          enum: ['first_frame', 'last_frame', 'reference_image'],
        },
      },
    },
    {
      type: 'object',
      required: ['type', 'video_url'],
      properties: {
        type: { const: 'video_url' },
        video_url: {
          type: 'object',
          required: ['url'],
          properties: { url: { type: 'string' } },
        },
        role: { type: 'string', enum: ['reference_video'] },
      },
    },
    {
      type: 'object',
      required: ['type', 'audio_url'],
      properties: {
        type: { const: 'audio_url' },
        audio_url: {
          type: 'object',
          required: ['url'],
          properties: { url: { type: 'string' } },
        },
        role: { type: 'string', enum: ['reference_audio'] },
      },
    },
    {
      type: 'object',
      required: ['type', 'draft_task'],
      properties: {
        type: { const: 'draft_task' },
        draft_task: { type: 'object' },
      },
    },
  ],
};

const byteplusSeedanceRequest = {
  type: 'object',
  required: ['model', 'content'],
  properties: {
    model: { type: 'string' },
    content: { type: 'array', items: byteplusContentItem },
    resolution: {
      type: 'string',
      enum: ['480p', '720p', '1080p'],
      default: '1080p',
    },
    ratio: {
      type: 'string',
      enum: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive'],
      default: '16:9',
    },
    duration: { type: 'integer', minimum: 2, maximum: 12, default: 5 },
    frames: { type: 'integer', enum: byteplusSupportedFrameCounts },
    seed: { type: 'integer', minimum: -1, maximum: 4_294_967_295, default: -1 },
    camera_fixed: { type: 'boolean', default: false },
    watermark: { type: 'boolean', default: false },
    callback_url: { type: 'string', format: 'uri' },
    return_last_frame: { type: 'boolean', default: false },
    service_tier: {
      type: 'string',
      enum: ['default', 'flex'],
      default: 'default',
    },
    execution_expires_after: {
      type: 'integer',
      minimum: 3_600,
      maximum: 259_200,
      default: 172_800,
    },
    safety_identifier: { type: 'string', maxLength: 64 },
  },
};

const byteplusSeedance15BaseProperties = Object.fromEntries(
  Object.entries(byteplusSeedanceRequest.properties).filter(
    ([key]) => key !== 'frames',
  ),
);

const byteplusDreaminaSeedanceBaseProperties = Object.fromEntries(
  Object.entries(byteplusSeedanceRequest.properties).filter(
    ([key]) => !['camera_fixed', 'frames', 'service_tier'].includes(key),
  ),
);

const byteplusSeedance15Request = {
  ...byteplusSeedanceRequest,
  properties: {
    ...byteplusSeedance15BaseProperties,
    resolution: {
      type: 'string',
      enum: ['480p', '720p', '1080p'],
      default: '720p',
    },
    ratio: {
      type: 'string',
      enum: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive'],
      default: 'adaptive',
    },
    duration: {
      anyOf: [
        { type: 'integer', const: -1 },
        { type: 'integer', minimum: 4, maximum: 12 },
      ],
      default: 5,
    },
    generate_audio: { type: 'boolean', default: true },
    draft: { type: 'boolean', default: false },
  },
};

const byteplusDreaminaSeedanceRequest = {
  ...byteplusSeedanceRequest,
  properties: {
    ...byteplusDreaminaSeedanceBaseProperties,
    resolution: {
      type: 'string',
      enum: ['480p', '720p', '1080p'],
      default: '720p',
    },
    ratio: {
      type: 'string',
      enum: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive'],
      default: 'adaptive',
    },
    duration: {
      anyOf: [
        { type: 'integer', const: -1 },
        { type: 'integer', minimum: 4, maximum: 15 },
      ],
      default: 5,
    },
    generate_audio: { type: 'boolean', default: true },
    priority: { type: 'integer', minimum: 0, maximum: 9, default: 0 },
  },
};

const byteplusDreaminaSeedanceFastRequest = {
  ...byteplusDreaminaSeedanceRequest,
  properties: {
    ...byteplusDreaminaSeedanceRequest.properties,
    resolution: {
      type: 'string',
      enum: ['480p', '720p'],
      default: '720p',
    },
  },
};

const byteplusTaskResponse = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    status: { type: 'string' },
    content: {
      type: 'object',
      properties: {
        video_url: { type: 'string' },
        image_url: { type: 'string' },
        last_frame_url: { type: 'string' },
      },
    },
    error: { type: 'object' },
    created_at: { type: 'integer' },
    updated_at: { type: 'integer' },
    completed_at: { type: 'integer' },
  },
};

function byteplusImageSchema(request: JsonSchemaObject): ModelRawSchema {
  return {
    provider: 'byteplus',
    method: 'POST',
    endpoint:
      'https://ark.ap-southeast.bytepluses.com/api/v3/images/generations',
    request,
    response: byteplusImageResponse,
  };
}

function byteplusVideoSchema(request: JsonSchemaObject): ModelRawSchema {
  return {
    provider: 'byteplus',
    method: 'POST',
    endpoint:
      'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks',
    request,
    response: byteplusTaskResponse,
  };
}

const byteplusModelEntries = [
  {
    key: 'BYTEDANCE_SEEDREAM_4',
    modelIdentifier: 'bytedance/seedream-4',
    kind: 'image',
    provider: 'byteplus',
    rawId: 'seedream-4-0-250828',
    babychainConstraints: byteplusImageBabyChainConstraints,
    rawSchema: byteplusImageSchema(byteplusSeedream4Request),
  },
  {
    key: 'BYTEDANCE_SEEDREAM_45',
    modelIdentifier: 'bytedance/seedream-4.5',
    kind: 'image',
    provider: 'byteplus',
    rawId: 'seedream-4-5-251128',
    babychainConstraints: byteplusImageBabyChainConstraints,
    rawSchema: byteplusImageSchema(byteplusSeedream45Request),
  },
  {
    key: 'BYTEDANCE_SEEDREAM_5_LITE',
    modelIdentifier: 'bytedance/seedream-5-lite',
    kind: 'image',
    provider: 'byteplus',
    rawId: 'seedream-5-0-lite-260128',
    babychainConstraints: byteplusImageBabyChainConstraints,
    rawSchema: byteplusImageSchema(byteplusSeedream5LiteRequest),
  },
  {
    key: 'BYTEDANCE_SEEDANCE_1_PRO',
    modelIdentifier: 'bytedance/seedance-1-pro',
    kind: 'video',
    provider: 'byteplus',
    rawId: 'seedance-1-0-pro-250528',
    babychainConstraints: byteplusVideoBabyChainConstraints,
    rawSchema: byteplusVideoSchema(byteplusSeedanceRequest),
  },
  {
    key: 'BYTEDANCE_SEEDANCE_1_PRO_FAST',
    modelIdentifier: 'bytedance/seedance-1-pro-fast',
    kind: 'video',
    provider: 'byteplus',
    rawId: 'seedance-1-0-pro-fast-251015',
    babychainConstraints: byteplusVideoBabyChainConstraints,
    rawSchema: byteplusVideoSchema(byteplusSeedanceRequest),
  },
  {
    key: 'BYTEDANCE_SEEDANCE_15_PRO',
    modelIdentifier: 'bytedance/seedance-1.5-pro',
    kind: 'video',
    provider: 'byteplus',
    rawId: 'seedance-1-5-pro-251215',
    babychainConstraints: byteplusVideoBabyChainConstraints,
    rawSchema: byteplusVideoSchema(byteplusSeedance15Request),
  },
  {
    key: 'BYTEDANCE_SEEDANCE_20',
    modelIdentifier: 'bytedance/seedance-2.0',
    kind: 'video',
    provider: 'byteplus',
    rawId: 'dreamina-seedance-2-0-260128',
    babyseaCompatible: false,
    babychainConstraints: byteplusVideoBabyChainConstraints,
    rawSchema: byteplusVideoSchema(byteplusDreaminaSeedanceRequest),
  },
  {
    key: 'BYTEDANCE_SEEDANCE_20_FAST',
    modelIdentifier: 'bytedance/seedance-2.0-fast',
    kind: 'video',
    provider: 'byteplus',
    rawId: 'dreamina-seedance-2-0-fast-260128',
    babyseaCompatible: false,
    babychainConstraints: byteplusVideoBabyChainConstraints,
    rawSchema: byteplusVideoSchema(byteplusDreaminaSeedanceFastRequest),
  },
] satisfies readonly ModelCatalogEntry[];

// ----------------------------
// Google
// ----------------------------

const googleImageDataPart = {
  oneOf: [
    {
      type: 'object',
      required: ['text'],
      properties: { text: { type: 'string' } },
    },
    {
      type: 'object',
      required: ['inlineData'],
      properties: {
        inlineData: {
          type: 'object',
          required: ['mimeType', 'data'],
          properties: {
            mimeType: { type: 'string', examples: ['image/png'] },
            data: { type: 'string' },
          },
        },
      },
    },
    {
      type: 'object',
      required: ['fileData'],
      properties: {
        fileData: {
          type: 'object',
          required: ['fileUri'],
          properties: {
            fileUri: { type: 'string' },
            mimeType: { type: 'string', examples: ['image/png'] },
          },
        },
      },
    },
  ],
};

const googleGenerateContentImageRequest = {
  type: 'object',
  required: ['contents'],
  properties: {
    contents: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['parts'],
        properties: {
          role: { type: 'string', examples: ['user'] },
          parts: {
            type: 'array',
            minItems: 1,
            items: googleImageDataPart,
          },
        },
      },
    },
    generationConfig: {
      type: 'object',
      properties: {
        responseModalities: {
          type: 'array',
          items: { type: 'string', enum: ['IMAGE', 'TEXT'] },
          default: ['IMAGE'],
        },
        imageConfig: {
          type: 'object',
          properties: {
            aspectRatio: {
              type: 'string',
              enum: [
                '1:1',
                '3:4',
                '4:3',
                '9:16',
                '16:9',
                '1:4',
                '4:1',
                '1:8',
                '8:1',
              ],
              default: '1:1',
            },
            imageSize: {
              type: 'string',
              enum: ['0.5K', '1K', '2K', '4K'],
              default: '1K',
            },
          },
        },
      },
    },
  },
};

const googleGenerateContentImageResponse = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          content: {
            type: 'object',
            properties: {
              parts: {
                type: 'array',
                items: googleImageDataPart,
              },
            },
          },
        },
      },
    },
  },
};

const googleImagenRequest = {
  type: 'object',
  required: ['instances'],
  properties: {
    instances: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['prompt'],
        properties: { prompt: { type: 'string', maxLength: 480 } },
      },
    },
    parameters: {
      type: 'object',
      properties: {
        sampleCount: { type: 'integer', minimum: 1, maximum: 4, default: 4 },
        imageSize: { type: 'string', enum: ['1K', '2K'], default: '1K' },
        aspectRatio: {
          type: 'string',
          enum: ['1:1', '3:4', '4:3', '9:16', '16:9'],
          default: '1:1',
        },
        personGeneration: {
          type: 'string',
          enum: ['dont_allow', 'allow_adult', 'allow_all'],
          default: 'allow_adult',
        },
      },
    },
  },
};

const googleImagenResponse = {
  type: 'object',
  properties: {
    predictions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          bytesBase64Encoded: { type: 'string' },
          mimeType: { type: 'string' },
        },
      },
    },
  },
};

const googleVeoMedia = {
  type: 'object',
  required: ['bytesBase64Encoded', 'mimeType'],
  properties: {
    bytesBase64Encoded: { type: 'string' },
    mimeType: { type: 'string', examples: ['image/png'] },
  },
};

const googleVeoRequest = {
  type: 'object',
  required: ['instances'],
  properties: {
    instances: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: { type: 'string', maxLength: 1024 },
          image: googleVeoMedia,
          lastFrame: googleVeoMedia,
          video: googleVeoMedia,
          referenceImages: {
            type: 'array',
            maxItems: 3,
            items: {
              type: 'object',
              required: ['image', 'referenceType'],
              properties: {
                image: googleVeoMedia,
                referenceType: { type: 'string', enum: ['asset'] },
              },
            },
          },
        },
      },
    },
    parameters: {
      type: 'object',
      properties: {
        aspectRatio: {
          type: 'string',
          enum: ['16:9', '9:16'],
          default: '16:9',
        },
        durationSeconds: { type: 'integer', enum: [4, 6, 8], default: 8 },
        generateAudio: { type: 'boolean', default: true },
        negativePrompt: { type: 'string' },
        personGeneration: {
          type: 'string',
          enum: ['allow_all', 'allow_adult'],
        },
        resolution: {
          type: 'string',
          enum: ['720p', '1080p', '4K'],
          default: '720p',
        },
        seed: { type: 'integer', minimum: 0, maximum: 4_294_967_295 },
      },
    },
  },
};

const {
  referenceImages: _googleVeoLiteReferenceImages,
  video: _googleVeoLiteVideo,
  ...googleVeoLiteInstanceProperties
} = googleVeoRequest.properties.instances.items.properties;

const googleVeoLiteRequest = {
  ...googleVeoRequest,
  properties: {
    ...googleVeoRequest.properties,
    instances: {
      ...googleVeoRequest.properties.instances,
      items: {
        ...googleVeoRequest.properties.instances.items,
        properties: googleVeoLiteInstanceProperties,
      },
    },
    parameters: {
      ...googleVeoRequest.properties.parameters,
      properties: {
        ...googleVeoRequest.properties.parameters.properties,
        resolution: {
          type: 'string',
          enum: ['720p', '1080p'],
          default: '720p',
        },
      },
    },
  },
};

const googleVeoResponse = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    done: { type: 'boolean' },
    response: {
      type: 'object',
      properties: {
        generateVideoResponse: {
          type: 'object',
          properties: {
            generatedSamples: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  video: {
                    type: 'object',
                    properties: {
                      uri: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

function googleGenerateContentSchema(rawId: string): ModelRawSchema {
  return {
    provider: 'google',
    method: 'POST',
    endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${rawId}:generateContent`,
    request: googleGenerateContentImageRequest,
    response: googleGenerateContentImageResponse,
    notes: [
      'Set GEMINI_API_KEY or GOOGLE_API_KEY on the BabyChain server for BYOK mode.',
      'BabyChain sends x-goog-api-key with Google requests.',
    ],
  };
}

function googleImagenSchema(rawId: string): ModelRawSchema {
  return {
    provider: 'google',
    method: 'POST',
    endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${rawId}:predict`,
    request: googleImagenRequest,
    response: googleImagenResponse,
    notes: [
      'Set GEMINI_API_KEY or GOOGLE_API_KEY on the BabyChain server for BYOK mode.',
      'BabyChain sends x-goog-api-key with Google requests.',
    ],
  };
}

function googleVeoSchema(
  rawId: string,
  request: JsonSchemaObject = googleVeoRequest,
): ModelRawSchema {
  return {
    provider: 'google',
    method: 'POST',
    endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${rawId}:predictLongRunning`,
    request,
    response: googleVeoResponse,
    notes: [
      'Set GEMINI_API_KEY or GOOGLE_API_KEY on the BabyChain server for BYOK mode.',
      'BabyChain sends x-goog-api-key with Google requests.',
      'Poll the returned operation until done, then download generated videos before Google retention expires.',
    ],
  };
}

const googleModelEntries = [
  {
    key: 'GOOGLE_NANO_BANANA_2',
    modelIdentifier: 'google/nano-banana-2',
    kind: 'image',
    provider: 'google',
    rawId: 'gemini-3.1-flash-image',
    babyseaCompatible: false,
    rawSchema: googleGenerateContentSchema('gemini-3.1-flash-image'),
  },
  {
    key: 'GOOGLE_NANO_BANANA_PRO',
    modelIdentifier: 'google/nano-banana-pro',
    kind: 'image',
    provider: 'google',
    rawId: 'gemini-3-pro-image',
    babyseaCompatible: false,
    rawSchema: googleGenerateContentSchema('gemini-3-pro-image'),
  },
  {
    key: 'GOOGLE_NANO_BANANA',
    modelIdentifier: 'google/nano-banana',
    kind: 'image',
    provider: 'google',
    rawId: 'gemini-2.5-flash-image',
    babyseaCompatible: false,
    rawSchema: googleGenerateContentSchema('gemini-2.5-flash-image'),
  },
  {
    key: 'GOOGLE_IMAGEN_4',
    modelIdentifier: 'google/imagen-4',
    kind: 'image',
    provider: 'google',
    rawId: 'imagen-4.0-generate-001',
    babyseaCompatible: false,
    rawSchema: googleImagenSchema('imagen-4.0-generate-001'),
  },
  {
    key: 'GOOGLE_IMAGEN_4_ULTRA',
    modelIdentifier: 'google/imagen-4-ultra',
    kind: 'image',
    provider: 'google',
    rawId: 'imagen-4.0-ultra-generate-001',
    babyseaCompatible: false,
    rawSchema: googleImagenSchema('imagen-4.0-ultra-generate-001'),
  },
  {
    key: 'GOOGLE_IMAGEN_4_FAST',
    modelIdentifier: 'google/imagen-4-fast',
    kind: 'image',
    provider: 'google',
    rawId: 'imagen-4.0-fast-generate-001',
    babyseaCompatible: false,
    rawSchema: googleImagenSchema('imagen-4.0-fast-generate-001'),
  },
  {
    key: 'GOOGLE_VEO_31',
    modelIdentifier: 'google/veo-3.1',
    kind: 'video',
    provider: 'google',
    rawId: 'veo-3.1-generate-preview',
    babyseaCompatible: false,
    rawSchema: googleVeoSchema('veo-3.1-generate-preview'),
  },
  {
    key: 'GOOGLE_VEO_31_FAST',
    modelIdentifier: 'google/veo-3.1-fast',
    kind: 'video',
    provider: 'google',
    rawId: 'veo-3.1-fast-generate-preview',
    babyseaCompatible: false,
    rawSchema: googleVeoSchema('veo-3.1-fast-generate-preview'),
  },
  {
    key: 'GOOGLE_VEO_31_LITE',
    modelIdentifier: 'google/veo-3.1-lite',
    kind: 'video',
    provider: 'google',
    rawId: 'veo-3.1-lite-generate-preview',
    babyseaCompatible: false,
    rawSchema: googleVeoSchema(
      'veo-3.1-lite-generate-preview',
      googleVeoLiteRequest,
    ),
  },
] satisfies readonly ModelCatalogEntry[];

// ----------------------------
// OpenAI
// ----------------------------

const openAiImageGenerationRequest = {
  type: 'object',
  required: ['model', 'prompt'],
  properties: {
    model: { type: 'string', enum: ['gpt-image-2'] },
    prompt: { type: 'string', minLength: 1 },
    n: { type: 'integer', minimum: 1 },
    size: {
      type: 'string',
      examples: [
        'auto',
        '1024x1024',
        '1536x1024',
        '1024x1536',
        '2048x2048',
        '2048x1152',
        '3840x2160',
        '2160x3840',
      ],
      default: 'auto',
    },
    quality: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'auto'],
      default: 'auto',
    },
    output_format: {
      type: 'string',
      enum: ['png', 'jpeg', 'webp'],
      default: 'png',
    },
    output_compression: { type: 'integer', minimum: 0, maximum: 100 },
    background: {
      type: 'string',
      enum: ['auto', 'opaque', 'transparent'],
      default: 'auto',
    },
    moderation: {
      type: 'string',
      enum: ['auto', 'low'],
      default: 'auto',
    },
  },
};

const openAiImageEditRequest = {
  type: 'object',
  required: ['model', 'prompt', 'image'],
  properties: {
    ...openAiImageGenerationRequest.properties,
    image: {
      anyOf: [
        { type: 'string', minLength: 1 },
        {
          type: 'array',
          minItems: 1,
          items: { type: 'string', minLength: 1 },
        },
      ],
      description:
        'One or more image files for the OpenAI image edits endpoint. BabyChain accepts data URLs or HTTPS image URLs in BYOK mode and uploads them as multipart files.',
    },
    mask: {
      type: 'string',
      minLength: 1,
      description:
        'Optional mask image data URL or HTTPS URL for prompt-guided inpainting.',
    },
    input_fidelity: {
      type: 'string',
      enum: ['low', 'high'],
      default: 'low',
    },
  },
};

const openAiImageRequest = {
  anyOf: [openAiImageGenerationRequest, openAiImageEditRequest],
};

const openAiImageResponse = {
  type: 'object',
  properties: {
    created: { type: 'integer' },
    data: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          b64_json: { type: 'string' },
          revised_prompt: { type: 'string' },
        },
      },
    },
  },
};

const openAiModelEntries = [
  {
    key: 'OPENAI_GPT_IMAGE_2',
    modelIdentifier: 'gpt/image-2',
    kind: 'image',
    provider: 'openai',
    rawId: 'gpt-image-2',
    babyseaCompatible: false,
    rawSchema: {
      provider: 'openai',
      method: 'POST',
      endpoint: 'https://api.openai.com/v1/images/generations',
      request: openAiImageRequest,
      response: openAiImageResponse,
      notes: [
        'Set OPENAI_API_KEY on the BabyChain server for BYOK mode.',
        'BabyChain calls /v1/images/generations for text-to-image and /v1/images/edits when generation_input_file or image input is supplied.',
        'OpenAI returns base64 image data; BabyChain wraps b64_json outputs as data URI image files for downstream handoff.',
      ],
    },
  },
] satisfies readonly ModelCatalogEntry[];

// ----------------------------
// Runway
// ----------------------------

const runwayTaskConstraints = {
  callbackUrl: {
    not_supported: true,
    reason:
      'BabyChain owns provider polling and delivers one terminal callback through the top-level webhook_url.',
  },
};

const runwayVideoRatio = {
  type: 'string',
  examples: [
    '1280:720',
    '720:1280',
    '1104:832',
    '960:960',
    '832:1104',
    '1584:672',
  ],
  default: '1280:720',
};

const runwayImageRatio = {
  type: 'string',
  examples: [
    '1024:1024',
    '1080:1080',
    '1168:880',
    '1360:768',
    '1440:1080',
    '1080:1440',
    '1808:768',
    '1920:1080',
    '1080:1920',
    '2112:912',
    '1280:720',
    '720:1280',
    '720:720',
    '960:720',
    '720:960',
    '1680:720',
  ],
  default: '1280:720',
};

const runwayVideoToVideoRatio = {
  ...runwayVideoRatio,
  examples: [...runwayVideoRatio.examples, '848:480', '640:480'],
  description:
    'Deprecated by Runway for video-to-video; included only for raw API compatibility.',
};

const runwayReferenceImage = {
  type: 'object',
  required: ['uri'],
  properties: {
    uri: { type: 'string', format: 'uri' },
    tag: { type: 'string' },
  },
};

const runwayImageUri = {
  type: 'string',
  examples: ['https://example.com/source-image.png', 'runway://uploaded-image'],
};

const runwayVideoUri = {
  type: 'string',
  examples: ['https://example.com/source-video.mp4', 'runway://uploaded-video'],
};

const runwayImageReference = {
  type: 'object',
  required: ['type', 'uri'],
  properties: {
    type: { const: 'image' },
    uri: runwayImageUri,
  },
};

const runwayVideoReference = {
  type: 'object',
  required: ['type', 'uri'],
  properties: {
    type: { const: 'video' },
    uri: runwayVideoUri,
  },
};

const runwayTextToImageRequest = {
  type: 'object',
  required: ['model', 'promptText', 'ratio'],
  properties: {
    model: { type: 'string', enum: ['gen4_image', 'gen4_image_turbo'] },
    promptText: { type: 'string', maxLength: 1_000 },
    ratio: runwayImageRatio,
    referenceImages: {
      type: 'array',
      maxItems: 3,
      items: runwayReferenceImage,
    },
    seed: { type: 'integer', minimum: 0, maximum: 4_294_967_295 },
    contentModeration: {
      type: 'object',
      properties: {
        publicFigureThreshold: {
          type: 'string',
          enum: ['auto', 'low'],
          default: 'auto',
        },
      },
    },
  },
};

const runwayImageToVideoRequest = {
  type: 'object',
  required: ['model', 'promptImage', 'promptText', 'ratio', 'duration'],
  properties: {
    model: { type: 'string', enum: ['gen4.5', 'gen4_turbo'] },
    promptImage: {
      oneOf: [
        runwayImageUri,
        {
          type: 'array',
          minItems: 1,
          maxItems: 1,
          items: {
            type: 'object',
            required: ['uri', 'position'],
            properties: {
              uri: runwayImageUri,
              position: { const: 'first' },
            },
          },
        },
      ],
    },
    promptText: { type: 'string', maxLength: 1_000 },
    ratio: runwayVideoRatio,
    duration: { type: 'integer', minimum: 2, maximum: 10, default: 5 },
    seed: { type: 'integer', minimum: 0, maximum: 4_294_967_295 },
    contentModeration: {
      type: 'object',
      properties: {
        publicFigureThreshold: {
          type: 'string',
          enum: ['auto', 'low'],
          default: 'auto',
        },
      },
    },
  },
};

const runwayVideoToVideoRequest = {
  type: 'object',
  required: ['model', 'videoUri', 'promptText'],
  properties: {
    model: { type: 'string', enum: ['aleph2', 'gen4_aleph'] },
    videoUri: runwayVideoUri,
    promptText: { type: 'string', maxLength: 1_000 },
    references: {
      type: 'array',
      maxItems: 1,
      items: runwayImageReference,
    },
    seed: { type: 'integer', minimum: 0, maximum: 4_294_967_295 },
    contentModeration: {
      type: 'object',
      properties: {
        publicFigureThreshold: {
          type: 'string',
          enum: ['auto', 'low'],
          default: 'auto',
        },
      },
    },
    ratio: runwayVideoToVideoRatio,
  },
};

const runwayCharacterPerformanceRequest = {
  type: 'object',
  required: ['model', 'character', 'reference'],
  properties: {
    model: { type: 'string', enum: ['act_two'] },
    character: {
      oneOf: [runwayImageReference, runwayVideoReference],
    },
    reference: runwayVideoReference,
    seed: { type: 'integer', minimum: 0, maximum: 4_294_967_295 },
    bodyControl: { type: 'boolean' },
    expressionIntensity: {
      type: 'integer',
      minimum: 1,
      maximum: 5,
      default: 3,
    },
    ratio: runwayVideoRatio,
    contentModeration: {
      type: 'object',
      properties: {
        publicFigureThreshold: {
          type: 'string',
          enum: ['auto', 'low'],
          default: 'auto',
        },
      },
    },
  },
};

const runwayTaskResponse = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    status: {
      type: 'string',
      enum: [
        'PENDING',
        'THROTTLED',
        'RUNNING',
        'SUCCEEDED',
        'FAILED',
        'CANCELED',
      ],
    },
    output: { type: 'array', items: { type: 'string', format: 'uri' } },
    failure: {
      anyOf: [
        { type: 'string' },
        {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
        { type: 'null' },
      ],
    },
    failureCode: { type: ['string', 'null'] },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
};

function runwaySchema(
  endpoint:
    | '/v1/text_to_image'
    | '/v1/image_to_video'
    | '/v1/video_to_video'
    | '/v1/character_performance',
  request: JsonSchemaObject,
): ModelRawSchema {
  return {
    provider: 'runway',
    method: 'POST',
    endpoint: `https://api.dev.runwayml.com${endpoint}`,
    request,
    response: runwayTaskResponse,
    notes: [
      'Set RUNWAYML_API_SECRET on the BabyChain server for BYOK mode.',
      'BabyChain sends X-Runway-Version: 2024-11-06 on Runway requests.',
    ],
  };
}

const runwayModelEntries = [
  {
    key: 'RUNWAY_ALEPH_2',
    modelIdentifier: 'runway/aleph-2',
    kind: 'video',
    provider: 'runway',
    rawId: 'aleph2',
    babyseaCompatible: false,
    babychainConstraints: runwayTaskConstraints,
    rawSchema: runwaySchema('/v1/video_to_video', runwayVideoToVideoRequest),
  },
  {
    key: 'RUNWAY_ACT_TWO',
    modelIdentifier: 'runway/act-two',
    kind: 'video',
    provider: 'runway',
    rawId: 'act_two',
    babyseaCompatible: false,
    babychainConstraints: runwayTaskConstraints,
    rawSchema: runwaySchema(
      '/v1/character_performance',
      runwayCharacterPerformanceRequest,
    ),
  },
  {
    key: 'RUNWAY_GEN_4_IMAGE',
    modelIdentifier: 'runway/gen-4-image',
    kind: 'image',
    provider: 'runway',
    rawId: 'gen4_image',
    babyseaCompatible: false,
    babychainConstraints: runwayTaskConstraints,
    rawSchema: runwaySchema('/v1/text_to_image', runwayTextToImageRequest),
  },
  {
    key: 'RUNWAY_GEN_4_IMAGE_TURBO',
    modelIdentifier: 'runway/gen-4-image-turbo',
    kind: 'image',
    provider: 'runway',
    rawId: 'gen4_image_turbo',
    babyseaCompatible: false,
    babychainConstraints: runwayTaskConstraints,
    rawSchema: runwaySchema('/v1/text_to_image', runwayTextToImageRequest),
  },
  {
    key: 'RUNWAY_GEN_45',
    modelIdentifier: 'runway/gen-4.5',
    kind: 'video',
    provider: 'runway',
    rawId: 'gen4.5',
    babyseaCompatible: false,
    babychainConstraints: runwayTaskConstraints,
    rawSchema: runwaySchema('/v1/image_to_video', runwayImageToVideoRequest),
  },
  {
    key: 'RUNWAY_GEN_4_ALEPH',
    modelIdentifier: 'runway/gen-4-aleph',
    kind: 'video',
    provider: 'runway',
    rawId: 'gen4_aleph',
    babyseaCompatible: false,
    babychainConstraints: runwayTaskConstraints,
    rawSchema: runwaySchema('/v1/video_to_video', runwayVideoToVideoRequest),
  },
  {
    key: 'RUNWAY_GEN_4_TURBO',
    modelIdentifier: 'runway/gen-4-turbo',
    kind: 'video',
    provider: 'runway',
    rawId: 'gen4_turbo',
    babyseaCompatible: false,
    babychainConstraints: runwayTaskConstraints,
    rawSchema: runwaySchema('/v1/image_to_video', runwayImageToVideoRequest),
  },
] satisfies readonly ModelCatalogEntry[];

export const MODEL_CATALOG = [
  ...alibabaCloudModelEntries,
  ...bflModelEntries,
  ...byteplusModelEntries,
  ...googleModelEntries,
  ...openAiModelEntries,
  ...runwayModelEntries,
] satisfies readonly ModelCatalogEntry[];
