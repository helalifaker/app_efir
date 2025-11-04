import Link from 'next/link';

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-6">
          <span className="text-3xl font-bold text-white">EF</span>
        </div>
        <h1 className="text-5xl font-bold text-slate-900 dark:text-white mb-4">
          EFIR Financial Platform
        </h1>
        <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-8">
          Manage your financial models, versions, and reports with a modern, professional interface.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium shadow-lg hover:shadow-xl hover:from-blue-600 hover:to-purple-700 transition-all"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/versions"
            className="px-6 py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
          >
            View Versions
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 card-hover">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl mb-4">
            📊
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Financial Models</h3>
          <p className="text-slate-600 dark:text-slate-400">
            Create and manage comprehensive financial models with multiple versions.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 card-hover">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-xl mb-4">
            ⚖️
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Version Comparison</h3>
          <p className="text-slate-600 dark:text-slate-400">
            Compare multiple versions side-by-side with detailed analysis and deltas.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 card-hover">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center text-white text-xl mb-4">
            📄
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Reports & Export</h3>
          <p className="text-slate-600 dark:text-slate-400">
            Generate professional reports and export data in multiple formats.
          </p>
        </div>
      </div>
    </div>
  );
}
