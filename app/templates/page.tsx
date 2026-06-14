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
  createSemanticRequestSchema,
  isImageInputCapableModel,
  isImageToVideoChainModel,
  isVideoToVideoChainModel,
} from '@/lib/models/semantic-schema';

import { TemplateDetailClient } from './template-detail-client';

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

function sortedIdentifiers(models: Array<{ modelIdentifier: string }>) {
  return models
    .map((model) => model.modelIdentifier)
    .sort((first, second) => {
      const firstName = formatPublicModelName(first);
      const secondName = formatPublicModelName(second);

      return firstName.localeCompare(secondName) || first.localeCompare(second);
    });
}
