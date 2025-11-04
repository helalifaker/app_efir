// app/versions/[id]/capex/page.tsx
import { getVersionWithTabs } from "@/lib/getVersionWithTabs";
import TabEditor from "../TabEditor";
import ExportButton from "../ExportButton";

export default async function CapexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { version, tabs } = await getVersionWithTabs(id);
  const tabData = (tabs?.capex?.data ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">CAPEX</h2>
        <ExportButton
          tabName="capex"
          tab="capex"
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

      {version.status === 'Locked' || version.status === 'Archived' ? (
        <pre className="text-xs bg-slate-50 dark:bg-slate-900 p-3 rounded-lg overflow-auto border border-slate-200 dark:border-slate-700 font-mono">
          {JSON.stringify(tabData, null, 2)}
        </pre>
      ) : (
        <TabEditor
          versionId={id}
          tab="capex"
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

