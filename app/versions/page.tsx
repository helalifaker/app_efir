'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
// formatNumber is available but not used in this component
import { VersionStatus } from '@/types';
import toast from 'react-hot-toast';
import { logger } from '@/lib/logger';
import { 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  // ArrowUpDown is available but not used in this component
  FileText,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  FolderOpen
} from 'lucide-react';

type Version = {
  id: string;
  name: string;
  status: VersionStatus;
  model_id: string;
  model_name: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

type Pagination = {
  total: number;
  limit: number;
  offset: number;
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

function VersionsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [versions, setVersions] = useState<Version[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<VersionStatus | ''>('');
  const [modelFilter, setModelFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'updated_at' | 'status'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [allModels, setAllModels] = useState<Array<{ id: string; name: string }>>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState<string>('');

  // Load models for filter
  useEffect(() => {
    async function loadModels() {
      try {
        const res = await fetch('/api/models');
        if (res.ok) {
          const data = await res.json();
          setAllModels(data.models || []);
        }
      } catch (e) {
        logger.error('Failed to load models', e);
      }
    }
    loadModels();
  }, []);

  // Handle query params
  useEffect(() => {
    const status = searchParams.get('status');
    const modelId = searchParams.get('model_id');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort_by');
    const order = searchParams.get('sort_order');
    
    if (status) setStatusFilter(status as VersionStatus);
    if (modelId) setModelFilter(modelId);
    if (search) {
      setSearchQuery(search);
      setSearchInput(search);
    }
    if (sort && ['created_at', 'updated_at', 'name', 'status'].includes(sort)) {
      setSortBy(sort as 'created_at' | 'updated_at' | 'name' | 'status');
    }
    if (order) setSortOrder(order as 'asc' | 'desc');
    
    // Show filters if any are active
    if (status || modelId || search) {
      setShowFilters(true);
    }
  }, [searchParams]);

  // Load versions
  useEffect(() => {
    async function loadVersions() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (statusFilter) params.set('status', statusFilter);
        if (modelFilter) params.set('model_id', modelFilter);
        if (searchQuery) params.set('search', searchQuery);
        params.set('sort_by', sortBy);
        params.set('sort_order', sortOrder);
        params.set('limit', '50');
        params.set('offset', '0');
        
        const res = await fetch(`/api/versions/list?${params.toString()}`);
        const data = await res.json();
        
        if (data.versions) {
          setVersions(data.versions);
          setPagination(data.pagination);
        }
      } catch (e) {
        logger.error('Failed to load versions', e);
        toast.error('Failed to load versions');
      } finally {
        setLoading(false);
      }
    }

    loadVersions();
  }, [statusFilter, modelFilter, searchQuery, sortBy, sortOrder]);

  const updateFilters = (newFilters: Partial<{ status: VersionStatus | ''; model: string; search: string }>) => {
    const params = new URLSearchParams();
    
    const status = newFilters.status !== undefined ? newFilters.status : statusFilter;
    const model = newFilters.model !== undefined ? newFilters.model : modelFilter;
    const search = newFilters.search !== undefined ? newFilters.search : searchQuery;
    
    if (status) params.set('status', status);
    if (model) params.set('model_id', model);
    if (search) params.set('search', search);
    if (sortBy !== 'created_at') params.set('sort_by', sortBy);
    if (sortOrder !== 'desc') params.set('sort_order', sortOrder);
    
    router.replace(`/versions?${params.toString()}`, { scroll: false });
  };

  const clearFilters = () => {
    setStatusFilter('');
    setModelFilter('');
    setSearchQuery('');
    setSearchInput('');
    router.replace('/versions', { scroll: false });
  };

  const handleSearch = () => {
    updateFilters({ search: searchInput });
  };

  const activeFiltersCount = [statusFilter, modelFilter, searchQuery].filter(Boolean).length;

  const getStatusConfig = (status: VersionStatus) => {
    switch (status) {
      case 'Ready':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/20',
          text: 'text-emerald-700 dark:text-emerald-400',
          border: 'border-emerald-200 dark:border-emerald-800',
          dot: 'bg-emerald-500'
        };
      case 'Locked':
        return {
          bg: 'bg-slate-50 dark:bg-slate-900',
          text: 'text-slate-700 dark:text-slate-300',
          border: 'border-slate-200 dark:border-slate-700',
          dot: 'bg-slate-500'
        };
      case 'Draft':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/20',
          text: 'text-amber-700 dark:text-amber-400',
          border: 'border-amber-200 dark:border-amber-800',
          dot: 'bg-amber-500'
        };
      case 'Archived':
        return {
          bg: 'bg-rose-50 dark:bg-rose-950/20',
          text: 'text-rose-700 dark:text-rose-400',
          border: 'border-rose-200 dark:border-rose-800',
          dot: 'bg-rose-500'
        };
      default:
        return {
          bg: 'bg-slate-50 dark:bg-slate-900',
          text: 'text-slate-700 dark:text-slate-300',
          border: 'border-slate-200 dark:border-slate-700',
          dot: 'bg-slate-500'
        };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  if (loading && versions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <div className="w-8 h-8 border-2 border-gray-300 dark:border-gray-700 border-t-gray-900 dark:border-t-gray-100 rounded-full animate-spin mx-auto"></div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Loading versions...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
                Versions
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {pagination ? (
                  <>
                    {pagination.total} {pagination.total === 1 ? 'version' : 'versions'}
                    {activeFiltersCount > 0 && ` • ${activeFiltersCount} filter${activeFiltersCount > 1 ? 's' : ''} active`}
                  </>
                ) : (
                  'Manage and view all financial model versions'
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all ${
                  showFilters || activeFiltersCount > 0
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white'
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span className="text-sm font-medium">Filters</span>
                {activeFiltersCount > 0 && (
                  <span className="px-2 py-0.5 bg-white/20 dark:bg-gray-900/20 rounded-full text-xs font-medium">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              placeholder="Search versions by name..."
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl text-sm text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all"
            />
            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput('');
                  updateFilters({ search: '' });
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              </button>
            )}
          </div>

          {/* Filters Panel */}
          {(showFilters || activeFiltersCount > 0) && (
            <div className="mb-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filters
                </h3>
                {activeFiltersCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Clear all
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Status Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Status
                  </label>
                  <div className="relative">
                    <select
                      value={statusFilter}
                      onChange={(e) => updateFilters({ status: e.target.value as VersionStatus | '' })}
                      className="w-full pl-4 pr-10 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent appearance-none transition-all"
                    >
                      <option value="">All statuses</option>
                      <option value="Draft">Draft</option>
                      <option value="Ready">Ready</option>
                      <option value="Locked">Locked</option>
                      <option value="Archived">Archived</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                  </div>
                </div>

                {/* Model Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Model
                  </label>
                  <div className="relative">
                    <select
                      value={modelFilter}
                      onChange={(e) => updateFilters({ model: e.target.value })}
                      className="w-full pl-4 pr-10 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent appearance-none transition-all"
                    >
                      <option value="">All models</option>
                      {allModels.map(model => (
                        <option key={model.id} value={model.id}>{model.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                  </div>
                </div>

                {/* Sort */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Sort by
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select
                        value={sortBy}
                        onChange={(e) => {
                          setSortBy(e.target.value as 'created_at' | 'updated_at' | 'name' | 'status');
                          updateFilters({});
                        }}
                        className="w-full pl-4 pr-10 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent appearance-none transition-all"
                      >
                        <option value="created_at">Created</option>
                        <option value="updated_at">Updated</option>
                        <option value="name">Name</option>
                        <option value="status">Status</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                    </div>
                    <button
                      onClick={() => {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        updateFilters({});
                      }}
                      className="px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center justify-center"
                      title={`Sort ${sortOrder === 'asc' ? 'ascending' : 'descending'}`}
                    >
                      {sortOrder === 'asc' ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Versions Table */}
        {versions.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-16">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <FolderOpen className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                  No versions found
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {activeFiltersCount > 0 
                    ? 'Try adjusting your filters to see more results.'
                    : 'Create a version to get started.'}
                </p>
              </div>
              {activeFiltersCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="mt-4 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Version
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Model
                    </th>
                    <th className="text-center px-6 py-4 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-right px-6 py-4 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="text-right px-6 py-4 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Updated
                    </th>
                    <th className="text-center px-6 py-4 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {versions.map((version) => {
                    const statusConfig = getStatusConfig(version.status);
                    return (
                      <tr
                        key={version.id}
                        className="group hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <Link
                            href={`/versions/${version.id}`}
                            className="flex items-center gap-3 group/link"
                          >
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm group-hover/link:scale-105 transition-transform">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white group-hover/link:text-blue-600 dark:group-hover/link:text-blue-400 transition-colors">
                                {version.name}
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <FolderOpen className="w-4 h-4" />
                            <span>{version.model_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`}></span>
                            <span className={`px-3 py-1 rounded-xl text-xs font-medium border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
                              {version.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(version.created_at)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Clock className="w-4 h-4" />
                            <span>{formatDate(version.updated_at)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Link
                            href={`/versions/${version.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            View
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="border-t border-gray-200 dark:border-gray-800 px-6 py-4 bg-gray-50 dark:bg-gray-900/50">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Showing <span className="font-medium text-gray-900 dark:text-white">{pagination.offset + 1}</span> to{' '}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {Math.min(pagination.offset + pagination.limit, pagination.total)}
                    </span>{' '}
                    of <span className="font-medium text-gray-900 dark:text-white">{pagination.total}</span> versions
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const newOffset = Math.max(0, pagination.offset - pagination.limit);
                        router.replace(`/versions?offset=${newOffset}`, { scroll: false });
                      }}
                      disabled={!pagination.hasPrevious}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>
                    <button
                      onClick={() => {
                        const newOffset = pagination.offset + pagination.limit;
                        router.replace(`/versions?offset=${newOffset}`, { scroll: false });
                      }}
                      disabled={!pagination.hasNext}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function VersionsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <div className="w-8 h-8 border-2 border-gray-300 dark:border-gray-700 border-t-gray-900 dark:border-t-gray-100 rounded-full animate-spin mx-auto"></div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <VersionsContent />
    </Suspense>
  );
}
