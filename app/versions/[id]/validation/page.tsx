// app/versions/[id]/validation/page.tsx
import { getVersionWithTabs } from "@/lib/getVersionWithTabs";
import TabEditor from "../TabEditor";
import ExportButton from "../ExportButton";

export default async function ValidationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { version, tabs, validations } = await getVersionWithTabs(id);
  const tabData = (tabs?.validation?.data ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Validation</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Assumptions and consistency validation checks
          </p>
        </div>
        <ExportButton
          tabName="validation"
          tab="validation"
          versionId={id}
          data={tabData}
          metadata={{
            modelName: version.model?.name || 'N/A',
            versionName: version.name,
            status: version.status,
            createdAt: new Date(version.created_at).toISOString(),
          }}
        />
      </div>

      {/* Validation Results Summary */}
      {validations.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-300 mb-2">
            Active Validations
          </h3>
          <p className="text-xs text-yellow-800 dark:text-yellow-400">
            {validations.length} validation {validations.length === 1 ? 'issue' : 'issues'} found. 
            See the sidebar for details.
          </p>
        </div>
      )}

      {version.status === 'Locked' || version.status === 'Archived' ? (
        <pre className="text-xs bg-slate-50 dark:bg-slate-900 p-3 rounded-lg overflow-auto border border-slate-200 dark:border-slate-700 font-mono">
          {JSON.stringify(tabData, null, 2)}
        </pre>
      ) : (
        <TabEditor
          versionId={id}
          tab="validation"
          initialData={tabData}
          metadata={{
            modelName: version.model?.name || 'N/A',
            versionName: version.name,
            status: version.status,
            createdAt: new Date(version.created_at).toISOString(),
          }}
        />
      )}
    </div>
  );
}

