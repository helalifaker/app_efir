// app/versions/[id]/assumptions/page.tsx
import { getVersionWithTabs } from "@/lib/getVersionWithTabs";
import TabEditor from "../TabEditor";
import ExportButton from "../ExportButton";
import Link from "next/link";

export default async function AssumptionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { version, tabs } = await getVersionWithTabs(id);
  const tabData = (tabs?.assumptions?.data ?? {}) as Record<string, unknown>;

  // Extract assumptions data with defaults
  const capacity = (tabData.capacity as Record<string, unknown>) || {};
  const rentModel = (tabData.rent_model as Record<string, unknown>) || {};
  const rentNarrative = (tabData.rent_narrative as string) || '';
  const capexInputs = (tabData.capex_inputs as Record<string, unknown>) || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Assumptions</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Version-specific drivers and assumptions (2028+)
          </p>
        </div>
        <ExportButton
          tabName="assumptions"
          tab="assumptions"
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
          {/* Capacity Assumptions (2028+) */}
          <section className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Capacity Assumptions (2028+)
              </h3>
              <Link
                href="/admin/parameters"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Configure Global Parameters →
              </Link>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Student capacity growth rates and projections
            </p>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Initial Capacity
                  </label>
                  <input
                    type="number"
                    defaultValue={capacity.initial_capacity as number}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Annual Growth Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    defaultValue={capacity.annual_growth_rate as number}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                    placeholder="0.0"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Rent Model */}
          <section className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Rent Model
              </h3>
              <Link
                href="/admin/parameters/rent-lease"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Configure Rent Settings →
              </Link>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Rent calculation inputs and assumptions
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Base Rent (SAR)
                </label>
                <input
                  type="number"
                  defaultValue={rentModel.base_rent as number}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Annual Increase (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  defaultValue={rentModel.annual_increase as number}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  placeholder="0.0"
                />
              </div>
            </div>
          </section>

          {/* Rent Narrative */}
          <section className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
              Rent Narrative
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Describe rent assumptions and methodology
            </p>
            <textarea
              defaultValue={rentNarrative}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
              placeholder="Enter rent narrative..."
            />
          </section>

          {/* CAPEX Inputs */}
          <section className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                CAPEX Inputs
              </h3>
              <Link
                href="/admin/parameters"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Configure Defaults →
              </Link>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Capital expenditure assumptions
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Annual CAPEX (SAR)
                </label>
                <input
                  type="number"
                  defaultValue={capexInputs.annual_capex as number}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Growth Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  defaultValue={capexInputs.growth_rate as number}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  placeholder="0.0"
                />
              </div>
            </div>
          </section>

          {/* Full Tab Editor for Additional Fields */}
          <section className="mt-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Additional Assumptions
            </h3>
            <TabEditor
              versionId={id}
              tab="assumptions"
              initialData={tabData}
              metadata={{
                modelName: version.model?.name || 'N/A',
                versionName: version.name,
                status: version.status,
                createdAt: new Date(version.created_at).toISOString(),
              }}
            />
          </section>
        </>
      )}
    </div>
  );
}

