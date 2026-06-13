import {
  InlineCloudflare,
  InlineCloudFormation,
  InlineCloudRun,
  InlineCoolify,
  InlineDigitalOcean,
  InlineDocker,
  InlineEc2,
  InlineFlyIo,
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
  catalogIntro,
  createHomepageMetrics,
  homepageCta,
  homepageHero,
  providerModes,
  siteFooter,
  siteNavigation,
  workflowNotes,
} from './_lib/homepage-content';

export const dynamic = 'force-dynamic';

const MODEL_CHAIN_PAGE_SIZE = 25;
const HOST_ICONS = [
  { Icon: InlineCloudflare, isActive: false, label: 'Cloudflare' },
  { Icon: InlineCloudFormation, isActive: false, label: 'CloudFormation' },
  { Icon: InlineCloudRun, isActive: false, label: 'Cloud Run' },
  { Icon: InlineCoolify, isActive: false, label: 'Coolify' },
  { Icon: InlineDigitalOcean, isActive: false, label: 'DigitalOcean' },
  { Icon: InlineDocker, isActive: false, label: 'Docker' },
  { Icon: InlineEc2, isActive: false, label: 'EC2' },
  { Icon: InlineFlyIo, isActive: false, label: 'Fly.io' },
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

        <CtaPanel
          {...homepageCta}
          deployLinks={homepageHero.console.deployLinks}
        />

        <SiteFooter {...siteFooter} homeHref={siteNavigation.homeHref} />
      </div>
    </main>
  );
}
