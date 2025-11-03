import { getVersionWithTabs } from '@/lib/getVersionWithTabs';
import { getSettings } from '@/lib/getSettings';
import './print.css';
import PrintButton from './PrintButton';

export default async function FinancialReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { version, tabs } = await getVersionWithTabs(id);
  const settings = await getSettings();

  const tabOrder = ['assumptions', 'overview', 'pnl', 'bs', 'cf', 'capex', 'controls'];
  
  // Format currency using admin settings
  const formatCurrency = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'number') {
      const { locale, decimals, compact } = settings.numberFormat;
      const currency = settings.ui.currency;
      
      // Format with locale and decimals
      const formatted = value.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        ...(compact && value >= 1000 ? { notation: 'compact' } : {}),
      });
      
      // Add currency symbol/prefix
      return `${formatted} ${currency}`;
    }
    return String(value);
  };

  const formatJsonForPrint = (data: any): string => {
    if (!data || typeof data !== 'object') return 'N/A';
    return JSON.stringify(data, null, 2);
  };

  return (
    <div className="report-container">
        {/* Screen-only actions */}
        <PrintButton versionId={id} />

        {/* Report Content */}
        <div className="report-content">
        {/* Report Header */}
        <div className="report-header avoid-break">
        <h1 className="text-3xl font-bold mb-3">Financial Report</h1>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-semibold">Model:</span> {version.model?.name || 'N/A'}
          </div>
          <div>
            <span className="font-semibold">Version:</span> {version.name}
          </div>
          <div>
            <span className="font-semibold">Status:</span> <span className="uppercase">{version.status}</span>
          </div>
          <div>
            <span className="font-semibold">Date:</span> {new Date(version.created_at).toLocaleDateString(settings.numberFormat.locale, { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
        </div>
      </div>

      {/* Sections */}
      {tabOrder.map((tabKey, idx) => {
        const tab = (tabs as any)?.[tabKey];
        const data = tab?.data || {};
        
        // Skip assumptions if no data exists
        if (tabKey === 'assumptions' && (!data || Object.keys(data).length === 0)) {
          return null;
        }

        return (
          <div key={tabKey} className={`report-section ${idx > 0 ? 'page-break' : ''}`}>
            <h2 className="section-title uppercase">
              {tabKey === 'pnl' ? 'Profit & Loss' : 
               tabKey === 'bs' ? 'Balance Sheet' :
               tabKey === 'cf' ? 'Cash Flow' :
               tabKey === 'capex' ? 'CAPEX' :
               tabKey === 'assumptions' ? 'Assumptions' :
               tabKey === 'overview' ? 'Overview' :
               tabKey === 'controls' ? 'Controls' :
               tabKey}
            </h2>

            {/* Display formatted data based on tab type */}
            {tabKey === 'overview' && (
              <div className="text-sm">
                <pre className="bg-gray-50 p-4 rounded border font-mono whitespace-pre-wrap">{formatJsonForPrint(data)}</pre>
              </div>
            )}

            {tabKey === 'pnl' && (
              <div className="text-sm">
                {data.revenue !== undefined && (
                  <div className="flex justify-between py-2 border-b">
                    <span>Revenue</span>
                    <span className="currency">{formatCurrency(data.revenue)}</span>
                  </div>
                )}
                {data.ebit !== undefined && (
                  <div className="flex justify-between py-2 border-b">
                    <span>EBIT</span>
                    <span className="currency">{formatCurrency(data.ebit)}</span>
                  </div>
                )}
                {data.net_income !== undefined && (
                  <div className="flex justify-between py-2 border-b font-bold">
                    <span>Net Income</span>
                    <span className="currency">{formatCurrency(data.net_income)}</span>
                  </div>
                )}
                {!data.revenue && !data.ebit && !data.net_income && (
                  <pre className="bg-gray-50 p-4 rounded border font-mono whitespace-pre-wrap">{formatJsonForPrint(data)}</pre>
                )}
              </div>
            )}

            {tabKey === 'bs' && (
              <div className="text-sm">
                {data.assets !== undefined && (
                  <div className="flex justify-between py-2 border-b">
                    <span>Assets</span>
                    <span className="currency">{formatCurrency(data.assets)}</span>
                  </div>
                )}
                {data.equity !== undefined && (
                  <div className="flex justify-between py-2 border-b">
                    <span>Equity</span>
                    <span className="currency">{formatCurrency(data.equity)}</span>
                  </div>
                )}
                {data.liabilities !== undefined && (
                  <div className="flex justify-between py-2 border-b">
                    <span>Liabilities</span>
                    <span className="currency">{formatCurrency(data.liabilities)}</span>
                  </div>
                )}
                {!data.assets && !data.equity && !data.liabilities && (
                  <pre className="bg-gray-50 p-4 rounded border font-mono whitespace-pre-wrap">{formatJsonForPrint(data)}</pre>
                )}
              </div>
            )}

            {tabKey === 'cf' && (
              <div className="text-sm">
                {data.operating !== undefined && (
                  <div className="flex justify-between py-2 border-b">
                    <span>Operating Cash Flow</span>
                    <span className="currency">{formatCurrency(data.operating)}</span>
                  </div>
                )}
                {data.investing !== undefined && (
                  <div className="flex justify-between py-2 border-b">
                    <span>Investing Cash Flow</span>
                    <span className="currency">{formatCurrency(data.investing)}</span>
                  </div>
                )}
                {data.financing !== undefined && (
                  <div className="flex justify-between py-2 border-b">
                    <span>Financing Cash Flow</span>
                    <span className="currency">{formatCurrency(data.financing)}</span>
                  </div>
                )}
                {!data.operating && !data.investing && !data.financing && (
                  <pre className="bg-gray-50 p-4 rounded border font-mono whitespace-pre-wrap">{formatJsonForPrint(data)}</pre>
                )}
              </div>
            )}

            {tabKey === 'capex' && (
              <div className="text-sm">
                {data.projects && Array.isArray(data.projects) ? (
                  <div className="space-y-3">
                    {data.projects.map((project: any, i: number) => (
                      <div key={i} className="border rounded p-3">
                        {project.name && <div className="font-semibold mb-1">{project.name}</div>}
                        {project.amount !== undefined && (
                          <div className="flex justify-between">
                            <span>Amount</span>
                            <span className="currency">{formatCurrency(project.amount)}</span>
                          </div>
                        )}
                        {project.status && <div className="text-xs text-gray-600 mt-1">Status: {project.status}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <pre className="bg-gray-50 p-4 rounded border font-mono whitespace-pre-wrap">{formatJsonForPrint(data)}</pre>
                )}
              </div>
            )}

            {(tabKey === 'controls' || tabKey === 'assumptions') && (
              <div className="text-sm">
                <pre className="bg-gray-50 p-4 rounded border font-mono whitespace-pre-wrap">{formatJsonForPrint(data)}</pre>
              </div>
            )}
          </div>
        );
      })}
        </div>
      </div>
  );
}
