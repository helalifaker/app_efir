// app/versions/[id]/pnl/page.tsx
import { getVersionWithTabs } from "@/lib/getVersionWithTabs";
import TabEditor from "../TabEditor";
import ExportButton from "../ExportButton";
import RevenueAnalysis from "../RevenueAnalysis";

export default async function PnlPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { version, tabs } = await getVersionWithTabs(id);
  const tabData = (tabs?.pnl?.data ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Profit & Loss</h2>
        <ExportButton
          tabName="pnl"
          tab="pnl"
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
        <>
          <TabEditor
            versionId={id}
            tab="pnl"
            initialData={tabData}
            metadata={{
              modelName: version.model?.name || 'N/A',
              versionName: version.name,
              status: version.status,
              createdAt: new Date(version.created_at).toISOString(),
            }}
          />
          
          {/* Revenue Analysis Section */}
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
            <RevenueAnalysis 
              pnlData={tabData as Record<string, unknown> | null} 
              versionName={version.name}
            />
          </div>
        </>
      )}
    </div>
  );
}

