import { Badge } from '@/components/ui/badge';

export function SectionHeading({
  align = 'left',
  description,
  eyebrow,
  title,
}: {
  align?: 'left' | 'center';
  description?: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <div
      className={
        align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'
      }
    >
      {eyebrow ? <Badge variant="muted">{eyebrow}</Badge> : null}
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
        {title === 'Orchestrate model-to-model workflows.' ? (
          <>
            Orchestrate <span className="text-primary">model-to-model</span>{' '}
            workflows.
          </>
        ) : title === 'Self-hosted with your own keys and environment.' ? (
          <>
            <span className="text-primary">Self-hosted</span> with your own keys
            and environment.
          </>
        ) : (
          title
        )}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-7 text-muted-foreground md:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}
