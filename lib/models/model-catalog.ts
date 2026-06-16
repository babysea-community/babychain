import 'server-only';

import {
  listModels,
  type SemanticLadyModel,
  type SemanticLadyModelKind,
  type SemanticLadyProvider,
  type SemanticLadyWorkflow,
} from 'semantic-lady';

export type ModelProvider = SemanticLadyProvider;
export type ModelKind = SemanticLadyModelKind;
export type ModelMode = 'babysea' | 'byok';

export type ModelCatalogEntry = {
  babyseaCompatible?: boolean;
  key: string;
  kind: ModelKind;
  modelIdentifier: string;
  provider: ModelProvider;
  rawId: string;
  uiName: string;
  workflows: readonly SemanticLadyWorkflow[];
};

const BABYSEA_COMPATIBLE_ALIBABA_MODELS = new Set(['qwen/image']);
const BYOK_ONLY_BYTEPLUS_MODELS = new Set([
  'bytedance/seedance-2.0',
  'bytedance/seedance-2.0-fast',
]);

export const MODEL_CATALOG = listModels().map(
  (model): ModelCatalogEntry => ({
    key: modelKey(model.apiName),
    kind: model.kind,
    modelIdentifier: model.apiName,
    provider: model.provider,
    rawId: model.providerModel,
    uiName: model.uiName,
    workflows: model.workflows,
    ...(isBabySeaCompatible(model) ? {} : { babyseaCompatible: false }),
  }),
);

function isBabySeaCompatible(model: SemanticLadyModel) {
  switch (model.provider) {
    case 'alibaba-cloud':
      return BABYSEA_COMPATIBLE_ALIBABA_MODELS.has(model.apiName);
    case 'byteplus':
      return !BYOK_ONLY_BYTEPLUS_MODELS.has(model.apiName);
    case 'google':
    case 'openai':
    case 'runway':
      return false;
    case 'black-forest-labs':
      return true;
  }
}

function modelKey(modelIdentifier: string) {
  return modelIdentifier
    .replace(/\./g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
