import { InlineAwsAurora } from '@/components/icons/inline-database';
import {
  InlineAwsCloudFormation,
  InlineAwsEc2,
  InlineCloudflare,
  InlineCoolify,
  InlineDigitalOcean,
  InlineDocker,
  InlineFlyIo,
  InlineGoogleCloudRun,
  InlineNetlify,
  InlineRailwayLight,
  InlineRenderLight,
  InlineVercelLight,
} from '@/components/icons/inline-host';
import {
  InlineAlibabaCloud as InlineInferenceAlibabaCloud,
  InlineBlackForestLabsLight as InlineInferenceBlackForestLabsLight,
  InlineBytePlus as InlineInferenceBytePlus,
  InlineCloudflare as InlineInferenceCloudflare,
  InlineGoogle as InlineInferenceGoogle,
  InlineIdeogramLight as InlineInferenceIdeogramLight,
  InlineKling as InlineInferenceKling,
  InlineMiniMax as InlineInferenceMiniMax,
  InlineOpenAILight as InlineInferenceOpenAILight,
  InlineRecraftLight as InlineInferenceRecraftLight,
  InlineRunwayLight as InlineInferenceRunwayLight,
  InlineTencentCloud as InlineInferenceTencentCloud,
} from '@/components/icons/inline-inference';
import { InlineAmazonNova } from '@/components/icons/inline-llm';
import {
  InlineAwsS3Storage,
  InlineVercelBlob,
} from '@/components/icons/inline-storage';
import {
  listModelChainCatalog,
  listModelChainCatalogPage,
} from '@/lib/chains/catalog';
import { listModelCatalog } from '@/lib/models/model-library';

import { CtaPanel } from './_components/cta-panel';
import { FeatureGrid } from './_components/feature-grid';
import { HomepageHero } from './_components/homepage-hero';
import { ModelChainGrid } from './_components/model-chain-grid';
import { SectionHeading } from './_components/section-heading';
import { SiteFooter } from './_components/site-footer';
import { SiteHeader } from './_components/site-header';
import {
  agenticWorkflow,
  catalogIntro,
  communityPrograms,
  communitySponsors,
  createHomepageMetrics,
  databaseEngine,
  homepageCta,
  homepageHero,
  providerModes,
  siteFooter,
  siteNavigation,
  workflowNotes,
} from './_lib/homepage-content';

export const dynamic = 'force-dynamic';

const MODEL_CHAIN_PAGE_SIZE = 10;
const HOST_ICONS = [
  {
    Icon: InlineAwsCloudFormation,
    isActive: true,
    label: 'AWS CloudFormation',
  },
  { Icon: InlineAwsEc2, isActive: true, label: 'AWS EC2' },
  { Icon: InlineCloudflare, isActive: false, label: 'Cloudflare' },
  { Icon: InlineCoolify, isActive: true, label: 'Coolify' },
  { Icon: InlineDigitalOcean, isActive: false, label: 'DigitalOcean' },
  { Icon: InlineDocker, isActive: true, label: 'Docker' },
  { Icon: InlineFlyIo, isActive: true, label: 'Fly.io' },
  { Icon: InlineGoogleCloudRun, isActive: true, label: 'Google Cloud Run' },
  { Icon: InlineNetlify, isActive: false, label: 'Netlify' },
  { Icon: InlineRailwayLight, isActive: false, label: 'Railway' },
  { Icon: InlineRenderLight, isActive: false, label: 'Render' },
  { Icon: InlineVercelLight, isActive: true, label: 'Vercel' },
] as const;
const INFERENCE_ICONS = [
  { Icon: InlineInferenceAlibabaCloud, isActive: true, label: 'Alibaba Cloud' },
  {
    Icon: InlineInferenceBlackForestLabsLight,
    isActive: true,
    label: 'Black Forest Labs',
  },
  { Icon: InlineInferenceBytePlus, isActive: true, label: 'BytePlus' },
  { Icon: InlineInferenceCloudflare, isActive: false, label: 'Cloudflare' },
  { Icon: InlineInferenceGoogle, isActive: true, label: 'Google' },
  { Icon: InlineInferenceIdeogramLight, isActive: false, label: 'Ideogram' },
  { Icon: InlineInferenceKling, isActive: false, label: 'Kling' },
  { Icon: InlineInferenceMiniMax, isActive: false, label: 'MiniMax' },
  { Icon: InlineInferenceOpenAILight, isActive: true, label: 'OpenAI' },
  { Icon: InlineInferenceRecraftLight, isActive: false, label: 'Recraft' },
  { Icon: InlineInferenceRunwayLight, isActive: true, label: 'Runway' },
  {
    Icon: InlineInferenceTencentCloud,
    isActive: false,
    label: 'Tencent Cloud',
  },
] as const;
const STORAGE_ICONS = [
  { Icon: InlineAwsS3Storage, label: 'AWS S3' },
  { Icon: InlineVercelBlob, label: 'Vercel Blob' },
] as const;

export default function HomePage() {
  const catalog = listModelChainCatalog();
  const models = listModelCatalog();
  const featuredCatalog = listModelChainCatalogPage({
    pageSize: MODEL_CHAIN_PAGE_SIZE,
  });
  const metrics = createHomepageMetrics({
    catalog,
    models,
  });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader
        actions={siteNavigation.actions}
        brand={siteNavigation.brand}
        deployLinks={homepageHero.console.deployLinks}
        homeHref={siteNavigation.homeHref}
      />

      <div className="flex flex-col gap-6 px-3 py-6 md:gap-12 md:px-5 md:py-12">
        <HomepageHero {...homepageHero} metrics={metrics} />

        <section id="agentic-workflow">
          <div className="mx-auto max-w-[1520px] border border-border bg-card">
            <div className="grid border-b border-border lg:grid-cols-[1fr_auto]">
              <div className="border-b border-border p-5 md:p-7 lg:border-b-0 lg:border-r">
                <SectionHeading
                  eyebrow={agenticWorkflow.eyebrow}
                  title={agenticWorkflow.title}
                  description={agenticWorkflow.description}
                  maxWidthClass="max-w-5xl"
                />
              </div>

              <div className="flex flex-col items-center justify-center p-5 text-center md:p-7 lg:w-96">
                <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {agenticWorkflow.modelLabel}
                </div>
                <span className="mt-4 grid size-20 place-items-center border border-border bg-muted">
                  <InlineAmazonNova aria-hidden="true" className="size-12" />
                </span>
                <div className="mt-3 text-lg font-semibold text-foreground">
                  {agenticWorkflow.modelName}
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_1fr_auto]">
              {agenticWorkflow.features.map((feature) => {
                const FeatureIcon = feature.icon;

                return (
                  <div
                    className="min-w-0 border-b border-border p-5 md:p-7 lg:border-b-0 lg:border-r"
                    key={feature.title}
                  >
                    <span className="grid size-12 place-items-center border border-border bg-muted text-foreground">
                      <FeatureIcon aria-hidden="true" className="size-5" />
                    </span>
                    <div className="mt-5 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {feature.label}
                    </div>
                    <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                      {feature.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      {feature.text}
                    </p>
                  </div>
                );
              })}

              <div className="flex flex-col items-center justify-center p-5 text-center md:p-7 lg:w-96">
                <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {agenticWorkflow.storageLabel}
                </div>
                <div className="mt-4 flex justify-center gap-1 sm:gap-2">
                  {STORAGE_ICONS.map(({ Icon, label }) => (
                    <span
                      aria-label={label}
                      className="grid size-20 place-items-center border border-border bg-muted text-foreground"
                      key={label}
                      role="img"
                      title={label}
                    >
                      <Icon className="size-12" aria-hidden="true" />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="database-engine">
          <div className="mx-auto max-w-[1520px] border border-border bg-card">
            <div className="grid lg:grid-cols-[1fr_auto]">
              <div className="border-b border-border p-5 md:p-7 lg:border-b-0 lg:border-r">
                <SectionHeading
                  eyebrow={databaseEngine.eyebrow}
                  title={databaseEngine.title}
                  description={databaseEngine.description}
                  maxWidthClass="max-w-5xl"
                />
              </div>

              <div className="flex flex-col items-center justify-center p-5 text-center md:p-7 lg:w-96">
                <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {databaseEngine.modelLabel}
                </div>
                <span className="mt-4 grid size-20 place-items-center border border-border bg-muted">
                  <InlineAwsAurora aria-hidden="true" className="size-12" />
                </span>
                <div className="mt-3 text-lg font-semibold text-foreground">
                  {databaseEngine.modelName}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="provider-modes">
          <div className="mx-auto max-w-[1520px] border border-border bg-card">
            <div className="grid border-b border-border lg:grid-cols-[1fr_auto]">
              <div className="border-b border-border p-5 md:p-7 lg:border-b-0 lg:border-r">
                <SectionHeading {...providerModes} />
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-[repeat(2,minmax(0,24rem))]">
                {providerModes.modes.map((mode) => {
                  const ModeIcon = mode.icon;

                  return (
                    <div
                      className="min-w-0 border-b border-border p-5 last:border-b-0 md:border-b-0 md:border-r md:p-7 md:last:border-r-0"
                      key={mode.title}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            {mode.label}
                          </div>
                          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                            {mode.title}
                          </h3>
                        </div>
                        <span className="grid size-12 shrink-0 place-items-center border border-border bg-muted text-foreground">
                          <ModeIcon aria-hidden="true" className="size-5" />
                        </span>
                      </div>

                      <p className="mt-5 text-sm leading-7 text-muted-foreground">
                        {mode.text}
                      </p>

                      <div className="mt-6 border border-border bg-muted/40 p-3 font-mono text-xs text-foreground">
                        {mode.env}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-5 py-4 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground md:px-7">
              {providerModes.footnote}
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-[1520px] border border-border bg-card">
            <div className="grid border-b border-border lg:grid-cols-[1fr_auto]">
              <div className="p-5 md:p-7">
                <SectionHeading {...catalogIntro} />
              </div>
              <div className="grid border-t border-border md:grid-cols-2 lg:grid-cols-[repeat(2,minmax(0,24rem))] lg:border-l lg:border-t-0">
                <div className="flex min-h-32 flex-col items-center justify-center border-b border-border p-5 text-center md:border-b-0 md:border-r md:p-7">
                  <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {catalogIntro.apiHostLabel}
                  </div>
                  <div className="mt-4 grid grid-cols-6 gap-1 sm:gap-2">
                    {HOST_ICONS.map(({ Icon, isActive, label }) => (
                      <span
                        aria-label={label}
                        className="grid size-10 place-items-center border border-border bg-muted text-foreground sm:size-12"
                        key={label}
                        role="img"
                        title={label}
                      >
                        <Icon
                          className={`size-7 ${
                            isActive ? '' : 'opacity-40 grayscale saturate-0'
                          }`}
                          aria-hidden="true"
                        />
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex min-h-32 flex-col items-center justify-center p-5 text-center md:p-7">
                  <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {catalogIntro.modelCatalogLabel}
                  </div>
                  <div className="mt-4 grid grid-cols-6 gap-1 sm:gap-2">
                    {INFERENCE_ICONS.map(({ Icon, isActive, label }) => (
                      <span
                        aria-label={isActive ? label : `${label}`}
                        className="grid size-10 place-items-center border border-border bg-muted text-foreground sm:size-12"
                        key={label}
                        role="img"
                        title={isActive ? label : `${label}`}
                      >
                        <Icon
                          className={`size-7 ${
                            isActive ? '' : 'opacity-40 grayscale saturate-0'
                          }`}
                          aria-hidden="true"
                        />
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <ModelChainGrid
              initialEntries={featuredCatalog.entries}
              initialTotal={featuredCatalog.total}
              pageSize={MODEL_CHAIN_PAGE_SIZE}
            />
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-[1520px] border border-border bg-card p-px">
            <FeatureGrid features={workflowNotes} />
          </div>
        </section>

        <section id="community-programs">
          <div className="mx-auto max-w-[1520px] border border-border bg-card">
            <div className="border-b border-border p-5 md:p-7">
              <SectionHeading
                eyebrow={communityPrograms.eyebrow}
                title={communityPrograms.title}
                descriptionContent={
                  <>
                    <a
                      href={communityPrograms.founderHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-foreground underline decoration-dotted decoration-muted-foreground/50 underline-offset-4 transition hover:text-primary hover:decoration-primary"
                    >
                      {communityPrograms.founderLabel}
                    </a>
                    {communityPrograms.description.slice(
                      communityPrograms.founderLabel.length,
                    )}
                  </>
                }
                maxWidthClass="max-w-5xl"
              />
            </div>
            <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
              {communityPrograms.programs.map((program) => (
                <div className="bg-card p-5 md:p-7" key={program.name}>
                  <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {program.org}
                  </div>
                  <div className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                    {program.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="sponsors">
          <div className="mx-auto max-w-[1520px] border border-border bg-card">
            <div className="border-b border-border p-5 md:p-7">
              <SectionHeading
                eyebrow={communitySponsors.eyebrow}
                title={communitySponsors.title}
                description={communitySponsors.description}
                maxWidthClass="max-w-5xl"
              />
            </div>
            <div className="grid gap-px bg-border">
              {communitySponsors.sponsors.map((sponsor) => (
                <div className="bg-card p-5 md:p-7" key={sponsor.name}>
                  <sponsor.icon
                    aria-label={sponsor.name}
                    className="h-8 w-auto"
                  />
                  <ul className="mt-4 space-y-1">
                    {sponsor.useCases.map((useCase) => (
                      <li
                        className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground"
                        key={useCase}
                      >
                        {useCase}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CtaPanel
          {...homepageCta}
          deployLinks={homepageHero.console.deployLinks}
        />

        <SiteFooter {...siteFooter} homeHref={siteNavigation.homeHref} />
      </div>
    </main>
  );
}
