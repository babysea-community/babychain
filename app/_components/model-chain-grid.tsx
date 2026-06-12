'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ModelChainCatalogEntry } from '@/lib/chains/catalog';
import { formatPublicModelName } from '@/lib/models/display';

import { ModelChainCard } from './model-chain-card';

export function ModelChainGrid({
  entries,
  pageSize = 25,
}: {
  entries: ModelChainCatalogEntry[];
  pageSize?: number;
}) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredEntries = useMemo(
    () =>
      normalizedQuery
        ? entries.filter((entry) =>
            createSearchText(entry).includes(normalizedQuery),
          )
        : entries,
    [entries, normalizedQuery],
  );
  const pageCount = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const startIndex = (currentPage - 1) * pageSize;
  const visibleEntries = filteredEntries.slice(
    startIndex,
    startIndex + pageSize,
  );
  const visibleStart = filteredEntries.length === 0 ? 0 : startIndex + 1;
  const visibleEnd = Math.min(startIndex + pageSize, filteredEntries.length);
  const visiblePageNumbers = getVisiblePageNumbers(currentPage, pageCount, 15);

  function goToPage(nextPage: number) {
    setPage(Math.min(Math.max(nextPage, 1), pageCount));
  }

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    setPage(1);
  }

  return (
    <div className="bg-background/50 p-5">
      <div className="mb-5 grid gap-3 border-b border-border pb-5 md:items-center xl:grid-cols-5">
        <div className="relative w-full xl:col-span-4">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            aria-label="Search model chains"
            className="h-10 w-full border border-border bg-card px-9 font-mono text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Search models or providers"
            type="text"
            value={query}
          />
          {query ? (
            <Button
              aria-label="Clear search"
              className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
              onClick={() => updateQuery('')}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
          ) : null}
        </div>
        <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground xl:justify-self-end">
          {visibleStart}-{visibleEnd} of{' '}
          {filteredEntries.length.toLocaleString('en-US')}
        </div>
      </div>

      {visibleEntries.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {visibleEntries.map((entry) => (
            <ModelChainCard entry={entry} key={entry.slug} />
          ))}
        </div>
      ) : (
        <div className="grid min-h-48 place-items-center border border-border bg-card p-6 text-center font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
          No model chains found
        </div>
      )}

      {pageCount > 1 ? (
        <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {visibleStart}-{visibleEnd} of{' '}
            {filteredEntries.length.toLocaleString('en-US')}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              aria-label="Previous page"
              disabled={currentPage === 1}
              onClick={() => goToPage(currentPage - 1)}
              size="icon"
              type="button"
              variant="outline"
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            {visiblePageNumbers.map((pageNumber) => {
              return (
                <Button
                  aria-current={pageNumber === currentPage ? 'page' : undefined}
                  key={`model-page-${pageNumber}`}
                  onClick={() => goToPage(pageNumber)}
                  size="sm"
                  type="button"
                  variant={pageNumber === currentPage ? 'default' : 'outline'}
                >
                  {pageNumber}
                </Button>
              );
            })}
            <Button
              aria-label="Next page"
              disabled={currentPage === pageCount}
              onClick={() => goToPage(currentPage + 1)}
              size="icon"
              type="button"
              variant="outline"
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getVisiblePageNumbers(
  currentPage: number,
  pageCount: number,
  maxVisiblePages: number,
) {
  const visibleCount = Math.min(pageCount, maxVisiblePages);
  const halfWindow = Math.floor(visibleCount / 2);
  let startPage = currentPage - halfWindow;
  let endPage = startPage + visibleCount - 1;

  if (startPage < 1) {
    startPage = 1;
    endPage = visibleCount;
  }

  if (endPage > pageCount) {
    endPage = pageCount;
    startPage = Math.max(1, endPage - visibleCount + 1);
  }

  return Array.from(
    { length: endPage - startPage + 1 },
    (_, index) => startPage + index,
  );
}

function createSearchText(entry: ModelChainCatalogEntry) {
  return [
    entry.badge,
    entry.routeLabel,
    entry.title,
    ...entry.modelIdentifiers,
    ...entry.modelIdentifiers.map(formatPublicModelName),
  ]
    .join(' ')
    .toLowerCase();
}
