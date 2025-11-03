'use client';

export default function PrintButton({ versionId }: { versionId: string }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="no-print mb-6 space-y-4">
      <div className="flex gap-4 items-center">
        <button
          onClick={handlePrint}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-md transition-colors"
        >
          📄 Download PDF / Print
        </button>
        <a
          href={`/version-detail/${versionId}`}
          className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← Back to Version
        </a>
      </div>
      
      {/* Print tips - hidden in print */}
      <div className="print-tips bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Printing Tips:</h3>
        <ul className="list-disc list-inside space-y-1 text-blue-800">
          <li>Click &quot;Download PDF&quot; to save as PDF or print</li>
          <li>Use &quot;Save as PDF&quot; in the print dialog for best results</li>
          <li>Ensure margins are set to &quot;Default&quot; or &quot;Minimum&quot;</li>
          <li>Headers and footers will appear on each page</li>
          <li>Page numbers are automatically included</li>
        </ul>
      </div>
    </div>
  );
}
