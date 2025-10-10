import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';

import { fetchCatalogModules } from '../services/catalogService';
import type { CatalogFilters, CatalogModule } from '../types';

const SUBJECT_OPTIONS = [
  'Science',
  'Mathematics',
  'English Language Arts',
  'Social Studies',
  'Electives',
];
const GRADE_OPTIONS = ['Pre-K', 'K', ...Array.from({ length: 12 }, (_, index) => String(index + 1))];
const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'title-asc', label: 'Title A → Z' },
  { value: 'title-desc', label: 'Title Z → A' },
  { value: 'grade-asc', label: 'Grade Low → High' },
  { value: 'grade-desc', label: 'Grade High → Low' },
];

const createDefaultFilters = (): CatalogFilters => ({
  page: 1,
  pageSize,
  sort: 'featured',
  standards: [],
});

const pageSize = 12;

const ModuleCard: React.FC<{ module: CatalogModule }> = ({ module }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
    <div>
      <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
        <span className="font-medium text-brand-blue">{module.subject}</span>
        <span className="px-2 py-1 rounded-full bg-brand-light-teal/40 text-brand-teal text-xs">
          Grade {module.gradeBand}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{module.title}</h3>
      <p className="text-sm text-gray-600 line-clamp-3 mb-3">
        {module.summary ?? 'Curated module built from open-licensed resources.'}
      </p>
      {module.strand && (
        <div className="mb-2 text-sm text-gray-500">Strand: {module.strand}</div>
      )}
      {module.topic && (
        <div className="mb-2 text-sm text-gray-500">Topic: {module.topic}</div>
      )}
    </div>
    <div className="mt-4 flex items-center justify-between">
      <div className="text-xs text-gray-400">
        {module.openTrack ? 'Open Track available' : 'Core module'}
      </div>
      <Link
        to={`/module/${module.id}`}
        className="inline-flex items-center px-3 py-1.5 rounded-md bg-brand-blue text-white text-sm font-medium hover:bg-brand-blue/90 transition-colors"
      >
        View module
      </Link>
    </div>
  </div>
);

const CatalogPage: React.FC = () => {
  const queryClient = useQueryClient();

  type CatalogFilterCache = {
    filters: CatalogFilters;
    searchTerm: string;
  };

  const cachedState = queryClient.getQueryData<CatalogFilterCache>(['catalog-filters']);

  const [filters, setFilters] = useState<CatalogFilters>(() => {
    if (cachedState?.filters) {
      return {
        ...createDefaultFilters(),
        ...cachedState.filters,
        standards: Array.isArray(cachedState.filters.standards)
          ? [...cachedState.filters.standards]
          : [],
      };
    }
    return createDefaultFilters();
  });
  const [searchTerm, setSearchTerm] = useState(
    cachedState?.searchTerm ?? cachedState?.filters.search ?? '',
  );
  const [standardInput, setStandardInput] = useState('');

  useEffect(() => {
    queryClient.setQueryData(['catalog-filters'], {
      filters: {
        ...filters,
        standards: Array.isArray(filters.standards) ? [...filters.standards] : [],
      },
      searchTerm,
    });
  }, [filters, searchTerm, queryClient]);

  const resolvedStandards = Array.isArray(filters.standards) ? filters.standards : [];

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['catalog-modules', filters],
    queryFn: () => fetchCatalogModules(filters),
    keepPreviousData: true,
  });

  const total = data?.total ?? 0;
  const modules = data?.data ?? [];

  const totalPages = useMemo(() => (total > 0 ? Math.ceil(total / pageSize) : 1), [total]);

  const handleTextFilterChange = (
    field: 'subject' | 'grade' | 'strand' | 'topic',
    value: string,
  ) => {
    const trimmed = value.trim();
    setFilters((previous) =>
      ({
        ...previous,
        [field]: trimmed.length > 0 ? trimmed : undefined,
        page: 1,
      }) as CatalogFilters,
    );
  };

  const applySearch = () => {
    const trimmed = searchTerm.trim();
    setFilters((previous) =>
      ({
        ...previous,
        search: trimmed.length > 0 ? trimmed : undefined,
        page: 1,
      }) as CatalogFilters,
    );
  };

  const handleSortChange = (value: string) => {
    setFilters((previous) =>
      ({
        ...previous,
        sort: value as CatalogFilters['sort'],
        page: 1,
      }) as CatalogFilters,
    );
  };

  const handleOpenTrackToggle = (value: boolean) => {
    setFilters((previous) =>
      ({
        ...previous,
        openTrack: value ? true : undefined,
        page: 1,
      }) as CatalogFilters,
    );
  };

  const handleAddStandard = () => {
    const trimmed = standardInput.trim();
    if (!trimmed) {
      return;
    }
    const normalized = trimmed.toUpperCase();
    setFilters((previous) => {
      const current = Array.isArray(previous.standards) ? previous.standards : [];
      if (current.includes(normalized)) {
        return previous;
      }
      return {
        ...previous,
        standards: [...current, normalized],
        page: 1,
      } as CatalogFilters;
    });
    setStandardInput('');
  };

  const handleRemoveStandard = (code: string) => {
    setFilters((previous) => {
      const current = Array.isArray(previous.standards) ? previous.standards : [];
      const nextStandards = current.filter((standard) => standard !== code);
      return {
        ...previous,
        standards: nextStandards,
        page: 1,
      } as CatalogFilters;
    });
  };

  const clearFilters = () => {
    setFilters(createDefaultFilters());
    setSearchTerm('');
    setStandardInput('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 pb-10">
      <section className="bg-gradient-to-r from-brand-blue to-brand-teal text-white py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h1 className="text-4xl font-bold mb-4">Curriculum Catalog</h1>
          <p className="max-w-2xl text-lg opacity-90">
            Explore ElevatED&apos;s open-licensed modules across subjects and grade bands. Filter
            by strand or topic to curate learning pathways in minutes.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 -mt-10">
        <div className="bg-white shadow-xl rounded-2xl p-6 border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Subject
              </label>
              <select
                value={filters.subject ?? ''}
                onChange={(event) => handleTextFilterChange('subject', event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
              >
                <option value="">All subjects</option>
                {SUBJECT_OPTIONS.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Grade
              </label>
              <select
                value={filters.grade ?? ''}
                onChange={(event) => handleTextFilterChange('grade', event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
              >
                <option value="">All grades</option>
                {GRADE_OPTIONS.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Strand
              </label>
              <input
                value={filters.strand ?? ''}
                onChange={(event) => handleTextFilterChange('strand', event.target.value)}
                placeholder="e.g. Earth & Space"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Topic
              </label>
              <input
                value={filters.topic ?? ''}
                onChange={(event) => handleTextFilterChange('topic', event.target.value)}
                placeholder="Topic keyword"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Standards
              </label>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <input
                  value={standardInput}
                  onChange={(event) => setStandardInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAddStandard();
                    }
                  }}
                  placeholder="Add standard code (e.g. NGSS-MS-PS2-1)"
                  className="w-full md:flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={handleAddStandard}
                  disabled={standardInput.trim().length === 0}
                  className="inline-flex items-center justify-center rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:bg-brand-blue/50"
                >
                  Add
                </button>
              </div>
              {resolvedStandards.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {resolvedStandards.map((standard) => (
                    <span
                      key={standard}
                      className="inline-flex items-center gap-2 rounded-full bg-brand-blue/10 px-3 py-1 text-xs font-semibold text-brand-blue"
                    >
                      {standard}
                      <button
                        type="button"
                        onClick={() => handleRemoveStandard(standard)}
                        className="text-brand-blue/70 transition-colors hover:text-rose-500"
                        aria-label={`Remove standard ${standard}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Open Track
              </label>
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2">
                <input
                  type="checkbox"
                  checked={Boolean(filters.openTrack)}
                  onChange={(event) => handleOpenTrackToggle(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
                />
                <span className="text-sm text-gray-600">Show modules with open track lessons</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1 md:w-64">
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearch();
                  }}
                  placeholder="Search by title, topic, or strand"
                  className="w-full rounded-lg border border-gray-200 pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              </div>
              <button
                type="button"
                onClick={applySearch}
                className="px-4 py-2 bg-brand-blue text-white rounded-lg text-sm font-medium hover:bg-brand-blue/90 transition-colors"
              >
                Search
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="px-3 py-2 text-sm text-brand-blue hover:underline"
              >
                Reset
              </button>
            </div>
            <div className="flex flex-col gap-2 text-sm text-gray-500 md:text-right">
              <label className="inline-flex items-center gap-2 text-gray-500">
                <span className="text-xs font-semibold uppercase">Sort</span>
                <select
                  value={filters.sort ?? 'featured'}
                  onChange={(event) => handleSortChange(event.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div>{isFetching ? 'Updating results…' : `${total} modules available`}</div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin h-8 w-8 border-4 border-brand-blue/30 border-t-brand-blue rounded-full" />
            </div>
          ) : modules.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center text-gray-500">
              No modules match the current filters. Try adjusting your search.
            </div>
          ) : (
            <>
              <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {modules.map((module) => (
                  <ModuleCard key={module.id} module={module} />
                ))}
              </div>
              <div className="mt-8 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    setFilters((previous) => ({
                      ...previous,
                      page: Math.max(1, (previous.page ?? 1) - 1),
                    }))
                  }
                  disabled={(filters.page ?? 1) <= 1}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Previous
                </button>

                <div className="text-sm text-gray-500">
                  Page {filters.page ?? 1} of {totalPages}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setFilters((previous) => ({
                      ...previous,
                      page: Math.min(totalPages, (previous.page ?? 1) + 1),
                    }))
                  }
                  disabled={(filters.page ?? 1) >= totalPages}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CatalogPage;
