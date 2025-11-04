// app/versions/[id]/layout.tsx
import { getVersionWithTabs } from "@/lib/getVersionWithTabs";
import ActionsBar from "./ActionsBar";
import TabNavigation from "./TabNavigation";
import Breadcrumbs from "@/lib/breadcrumbs";
import Link from "next/link";
import { ReactNode } from "react";

export default async function VersionLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: ReactNode;
}) {
  const { id } = await params;

  // Fetch version data
  const { version, validations, history } = await getVersionWithTabs(id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Versions', href: '/versions' },
          { label: version.name },
        ]}
      />
      
      <div className="flex flex-col lg:flex-row gap-6">
        {/* MAIN */}
        <main className="flex-1 space-y-6">
          {/* Header Section */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                  {version.name}
                </h1>
                <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                  <Link
                    href={`/versions?model_id=${version.model?.id}`}
                    className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <span className="font-medium">Model:</span>
                    {version.model?.name || 'N/A'}
                  </Link>
                  <span className="flex items-center gap-1">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      version.status === 'Draft' ? 'bg-yellow-500' :
                      version.status === 'Ready' ? 'bg-green-500' :
                      version.status === 'Locked' ? 'bg-slate-500' :
                      'bg-red-500'
                    }`}></span>
                    <span className="font-medium">{version.status}</span>
                  </span>
                </div>
              </div>
              <ActionsBar versionId={id} status={version.status as "Draft" | "Ready" | "Locked" | "Archived"} />
            </div>
          </div>

          {/* Tab Navigation */}
          <TabNavigation versionId={id} />

          {/* Tab Content */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            {children}
          </div>
        </main>

        {/* SIDEBAR */}
        <aside className="w-full lg:w-80 space-y-6">
          {/* Validations Section */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs">
                ✓
              </span>
              Validations
              <span className="ml-auto px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300">
                {validations.length}
              </span>
            </h2>
            <div className="space-y-2">
              {validations.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 italic">No validations</p>
              ) : (
                validations.map((v: { id: string; code: string; message: string; severity: string }) => (
                  <div
                    key={v.id}
                    className={`border rounded-lg p-3 ${
                      v.severity === "error"
                        ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20"
                        : "border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-900/20"
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      {v.code}
                    </p>
                    <p className="text-sm text-slate-900 dark:text-white">{v.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* History Section */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs">
                🕒
              </span>
              History
              <span className="ml-auto px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300">
                {history.length}
              </span>
            </h2>
            <div className="space-y-3">
              {history.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 italic">No status changes yet</p>
              ) : (
                history.map((h: { id: string; old_status: string; new_status: string; changed_at: string; changed_by: string | null }) => (
                  <div key={h.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        {h.old_status || <span className="italic">initial</span>}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="text-xs font-semibold text-slate-900 dark:text-white capitalize">
                        {h.new_status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {new Date(h.changed_at).toLocaleString()}
                      {h.changed_by && (
                        <span className="ml-1">• by {h.changed_by}</span>
                      )}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

