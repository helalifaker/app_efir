// app/version-detail/[id]/RevenueAnalysis.tsx
import { getSettings } from '@/lib/getSettings';
import { formatCurrencySAR } from '@/lib/utils';

type PnlData = {
  revenue?: number;
  students_count?: number;
  avg_tuition_fee?: number;
  other_income?: Record<string, any>;
  [key: string]: any;
};

export default async function RevenueAnalysis({ pnlData, versionName }: { pnlData: any; versionName: string }) {
  const settings = await getSettings();
  const vatRate = settings.vat.rate;
  
  // Type-safe extraction with fallbacks
  const data: PnlData = pnlData || {};
  const studentsCount = data.students_count || 0;
  const avgTuitionFee = data.avg_tuition_fee || 0;
  const avgTuitionWithVat = avgTuitionFee * (1 + vatRate);
  const totalRevenue = data.revenue || 0;
  const otherIncome = data.other_income || {};
  
  // Calculate breakdown
  const tuitionRevenue = studentsCount * avgTuitionFee;
  const otherIncomeTotal = typeof otherIncome === 'object' && !Array.isArray(otherIncome)
    ? Object.values(otherIncome).reduce((sum: number, val: any) => {
        const num = typeof val === 'number' ? val : parseFloat(String(val)) || 0;
        return sum + num;
      }, 0)
    : 0;

  const otherIncomeItems = typeof otherIncome === 'object' && !Array.isArray(otherIncome)
    ? Object.entries(otherIncome).map(([key, value]) => ({
        name: key,
        value: typeof value === 'number' ? value : parseFloat(String(value)) || 0,
      }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Revenue Analysis</h2>
        <p className="text-sm text-gray-500">{versionName}</p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700 font-medium mb-1">Students</p>
          <p className="text-2xl font-bold text-blue-900">{studentsCount.toLocaleString()}</p>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-700 font-medium mb-1">Avg Tuition Fee</p>
          <p className="text-2xl font-bold text-green-900">{formatCurrencySAR(avgTuitionFee)}</p>
        </div>
        
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-purple-700 font-medium mb-1">Avg Fee (incl. VAT)</p>
          <p className="text-2xl font-bold text-purple-900">{formatCurrencySAR(avgTuitionWithVat)}</p>
        </div>
        
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <p className="text-sm text-orange-700 font-medium mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-orange-900">{formatCurrencySAR(totalRevenue)}</p>
        </div>
      </div>

      {/* Tuition Breakdown */}
      <div className="bg-white border rounded-lg p-5">
        <h3 className="text-lg font-semibold mb-4">Tuition Revenue</h3>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div className="flex justify-between pb-3 border-b">
            <span className="text-gray-600">Students × Fee</span>
            <span className="font-mono font-semibold">{formatCurrencySAR(tuitionRevenue)}</span>
          </div>
          <div className="flex justify-between pb-3 border-b">
            <span className="text-gray-600">Other Income</span>
            <span className="font-mono font-semibold">{formatCurrencySAR(otherIncomeTotal)}</span>
          </div>
          <div className="flex justify-between col-span-2 pt-3 border-t">
            <span className="text-gray-900 font-semibold">Total Revenue</span>
            <span className="font-mono font-bold text-lg">{formatCurrencySAR(totalRevenue)}</span>
          </div>
        </div>
      </div>

      {/* Other Income Breakdown Table */}
      {otherIncomeItems.length > 0 && (
        <div className="bg-white border rounded-lg p-5">
          <h3 className="text-lg font-semibold mb-4">Other Income Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Income Source</th>
                  <th className="text-right px-4 py-3 font-semibold">Amount</th>
                  <th className="text-right px-4 py-3 font-semibold">% of Revenue</th>
                </tr>
              </thead>
              <tbody>
                {otherIncomeItems.map((item, idx) => {
                  const pctOfRevenue = totalRevenue > 0 ? (item.value / totalRevenue) * 100 : 0;
                  return (
                    <tr key={item.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      <td className="text-right px-4 py-3 font-mono">{formatCurrencySAR(item.value)}</td>
                      <td className="text-right px-4 py-3">{pctOfRevenue.toFixed(2)}%</td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-100 font-semibold border-t">
                  <td className="px-4 py-3">Total Other Income</td>
                  <td className="text-right px-4 py-3 font-mono">{formatCurrencySAR(otherIncomeTotal)}</td>
                  <td className="text-right px-4 py-3">
                    {totalRevenue > 0 ? ((otherIncomeTotal / totalRevenue) * 100).toFixed(2) : 0}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VAT Summary */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <span className="font-semibold">Note:</span> VAT rate is {(vatRate * 100).toFixed(1)}% as configured in Admin Settings.
        </p>
      </div>
    </div>
  );
}

