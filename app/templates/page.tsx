import type { Metadata } from 'next';

import { SiteHeader } from '@/app/_components/site-header';
import {
  chainDetailContent,
  homepageHero,
  siteNavigation,
} from '@/app/_lib/homepage-content';
import { canModifyVideoOutput } from '@/lib/chains/catalog';
import { formatPublicModelName } from '@/lib/models/display';
import { listModelCatalog } from '@/lib/models/model-library';
import {
  getSemanticModelSchemaFields,
  isImageInputCapableModel,
  isImageToVideoChainModel,
  isVideoToVideoChainModel,
} from '@/lib/models/semantic-schema';

import { TemplateDetailClient } from './template-detail-client';

type JsonObject = Record<string, unknown>;

export const metadata: Metadata = {
  title: 'Templates',
  description:
    'Choose any BabyChain image and video model combination on one template page.',
};

export const dynamic = 'force-dynamic';

export default function TemplatesPage() {
  const models = listModelCatalog();
  const imageModels = models.filter((model) => model.kind === 'image');
  const videoModels = models.filter((model) =>
    isImageToVideoChainModel(model.modelIdentifier),
  );
  const modifyModels = models.filter((model) =>
    isVideoToVideoChainModel(model.modelIdentifier),
  );

  const modelOptions = {
    imageModels: sortedIdentifiers(imageModels),
    refineModels: sortedIdentifiers(
      imageModels.filter((model) =>
        isImageInputCapableModel(model.modelIdentifier),
      ),
    ),
    videoModels: sortedIdentifiers(videoModels),
    modifyModels: sortedIdentifiers(modifyModels),
  };

  // Per-video-model list of compatible modify models (the Google → URL-only
  // provider handoff gate), so the client can filter the modify dropdown
  // without shipping the full combination matrix.
  const modifyCompatibility = Object.fromEntries(
    videoModels.map((videoModel) => [
      videoModel.modelIdentifier,
      sortedIdentifiers(
        modifyModels.filter((modifyModel) =>
          canModifyVideoOutput({ modifyModel, videoModel }),
        ),
      ),
    ]),
  );

  return (
    <>
      <SiteHeader
        actions={siteNavigation.actions}
        brand={siteNavigation.brand}
        deployLinks={homepageHero.console.deployLinks}
        homeHref={siteNavigation.homeHref}
      />
      <TemplateDetailClient
        content={chainDetailContent}
        modelRequestSchemas={createModelRequestSchemas()}
        modelOptions={modelOptions}
        modifyCompatibility={modifyCompatibility}
      />
    </>
  );
}

function createModelRequestSchemas() {
  return Object.fromEntries(
    listModelCatalog().map((model) => [
      model.modelIdentifier,
      createSemanticRequestSchema(model.modelIdentifier),
    ]),
  );
}

function createSemanticRequestSchema(modelIdentifier: string): JsonObject {
  const fields = getSemanticModelSchemaFields(modelIdentifier) ?? [];
  const required = fields
    .filter((field) => field.required)
    .map((field) => field.name);

  return {
    type: 'object',
    ...(required.length > 0 ? { required } : {}),
    properties: Object.fromEntries(
      fields.map((field) => [field.name, semanticFieldJsonSchema(field)]),
    ),
  };
}

function semanticFieldJsonSchema(field: {
  default?: unknown;
  enum?: readonly (number | string)[];
  max?: number;
  min?: number;
  type: string;
}) {
  const schema: JsonObject = {
    type: semanticJsonType(field.type),
  };

  if (field.enum && field.enum.length > 0) {
    schema.enum = [...field.enum];
  }

  if (field.default !== undefined) {
    schema.default = field.default;
  }

  if (typeof field.min === 'number') {
    schema.minimum = field.min;
  }

  if (typeof field.max === 'number') {
    schema.maximum = field.max;
  }

  if (field.type === 'integer') {
    schema.type = 'integer';
  }

  if (field.type === 'url-array' || field.type === 'string-array') {
    schema.items = {
      type: 'string',
      ...(field.type === 'url-array' ? { format: 'uri' } : {}),
    };
  }

  if (field.type === 'url') {
    schema.format = 'uri';
  }

  return schema;
}

function semanticJsonType(type: string) {
  switch (type) {
    case 'boolean':
      return 'boolean';
    case 'integer':
      return 'integer';
    case 'number':
      return 'number';
    case 'object':
      return 'object';
    case 'string-array':
    case 'url-array':
      return 'array';
    default:
      return 'string';
  }
}

function sortedIdentifiers(models: Array<{ modelIdentifier: string }>) {
  return models
    .map((model) => model.modelIdentifier)
    .sort((first, second) => {
      const firstName = formatPublicModelName(first);
      const secondName = formatPublicModelName(second);

      return firstName.localeCompare(secondName) || first.localeCompare(second);
    });
}
