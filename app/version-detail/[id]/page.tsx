// app/version-detail/[id]/page.tsx
import { getVersionWithTabs } from "../../../lib/getVersionWithTabs";
import ActionsBar from "./ActionsBar"; // ✅ default import (no curly braces)
import RevenueAnalysis from "./RevenueAnalysis";
import ExportButton from "./ExportButton";
import TabEditor from "./TabEditor";

export default async function VersionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Next.js 16: params is a Promise
  const { id } = await params;

  // fetch version + tabs + validations + history
  const { version, tabs, validations, history } = await getVersionWithTabs(id);

  return (
    <div className="flex">
      {/* MAIN */}
      <main className="flex-1 p-6 space-y-4">
        {/* actions on top */}
        <ActionsBar versionId={id} status={version.status as "draft" | "ready" | "locked"} />

        {/* header */}
        <header>
          <h1 className="text-2xl font-semibold">{version.name}</h1>
          <p className="text-sm text-gray-500">
            Model: {version.model?.name} • Status: {version.status}
          </p>
        </header>

        {/* 6 blocks */}
        <section className="grid grid-cols-2 gap-4">
          {(["overview", "pnl", "bs", "cf", "capex", "controls"] as const).map((key) => {
            const tabData = (tabs as any)?.[key]?.data ?? {};
            return (
              <div key={key} className="border rounded p-3 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold">{key.toUpperCase()}</h2>
                  <ExportButton
                    tabName={key}
                    tab={key}
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
                {version.status === 'locked' ? (
                  <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">
                    {JSON.stringify(tabData, null, 2)}
                  </pre>
                ) : (
                  <TabEditor
                    versionId={id}
                    tab={key}
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
          })}
        </section>

        {/* Revenue Analysis Section */}
        <section className="border-t pt-6 mt-6">
          <RevenueAnalysis 
            pnlData={(tabs as any)?.pnl?.data} 
            versionName={version.name}
          />
        </section>
      </main>

      {/* SIDEBAR */}
      <aside className="w-80 border-l p-4 bg-white space-y-6">
        {/* Validations Section */}
        <div>
          <h2 className="text-sm font-semibold mb-2">
            Validations ({validations.length})
          </h2>
          {validations.map((v: any) => (
            <div
              key={v.id}
              className={`border rounded p-2 mb-2 ${
                v.severity === "error"
                  ? "border-red-200 bg-red-50"
                  : "border-yellow-200 bg-yellow-50"
              }`}
            >
              <p className="text-[11px] uppercase tracking-wide text-gray-500">
                {v.code}
              </p>
              <p className="text-sm">{v.message}</p>
            </div>
          ))}
        </div>

        {/* History Section */}
        <div>
          <h2 className="text-sm font-semibold mb-2">
            History ({history.length})
          </h2>
          {history.length === 0 ? (
            <p className="text-xs text-gray-500 italic">No status changes yet</p>
          ) : (
            history.map((h: any) => (
              <div key={h.id} className="border rounded p-2 mb-2 bg-gray-50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">
                    {h.old_status || <span className="italic">initial</span>} →
                    <span className="font-semibold ml-1">{h.new_status}</span>
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">
                  {new Date(h.changed_at).toLocaleString()}
                  {h.changed_by_name && (
                    <span className="ml-1">by {h.changed_by_name}</span>
                  )}
                </p>
                {h.note && (
                  <p className="text-[11px] text-gray-600 mt-2 italic border-t pt-2">
                    {h.note}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
