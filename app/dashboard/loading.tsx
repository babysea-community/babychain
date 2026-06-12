import { Loader2 } from 'lucide-react';

/**
 * Shared loading state for dashboard pages. The library and canvas pages
 * read from Aurora on the server, so this paints immediately while data
 * loads instead of leaving a blank pane.
 */
export default function DashboardLoading() {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading…
      </div>
    </div>
  );
}
