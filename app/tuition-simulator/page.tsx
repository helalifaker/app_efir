'use client'

/**
 * Tuition Simulator Page
 * Rent-driven tuition simulation to maintain target EBITDA
 */

import { useState, useEffect } from 'react'

// ============================================================================
// TYPES
// ============================================================================

type RentModelType = 'FixedEscalation' | 'RevenueShare' | 'PartnerModel'

interface SimulationParams {
  versionId: string
  rentModel: RentModelType
  adjustmentFR: number
  adjustmentIB: number
  targetMargin?: number
  targetEbitda?: number
  years: {
    start: number
    end: number
  }
}

interface SimulationResult {
  year: number
  revenue: number
  staffCosts: number
  rent: number
  opex: number
  cogs: number
  ebitda: number
  ebitdaMarginPct: number
  rentLoadPct: number
  students: {
    fr: number
    ib: number
    total: number
  }
  tuition: {
    fr: number
    ib: number
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function TuitionSimulatorPage() {
  const [versions, setVersions] = useState<any[]>([])
  const [selectedVersion, setSelectedVersion] = useState<string>('')
  const [rentModel, setRentModel] = useState<RentModelType>('FixedEscalation')
  const [adjustmentFR, setAdjustmentFR] = useState<number>(0)
  const [adjustmentIB, setAdjustmentIB] = useState<number>(0)
  const [targetEbitda, setTargetEbitda] = useState<number>(0)
  const [startYear, setStartYear] = useState<number>(2028)
  const [endYear, setEndYear] = useState<number>(2040)
  const [results, setResults] = useState<SimulationResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load versions on mount
  useEffect(() => {
    async function fetchVersions() {
      try {
        const response = await fetch('/api/versions')
        if (!response.ok) throw new Error('Failed to fetch versions')

        const data = await response.json()
        setVersions(data.versions || [])

        if (data.versions && data.versions.length > 0) {
          setSelectedVersion(data.versions[0].id)
        }
      } catch (err) {
        console.error('Error loading versions:', err)
      }
    }

    fetchVersions()
  }, [])

  // Run simulation
  const handleRunSimulation = async () => {
    if (!selectedVersion) {
      setError('Please select a version')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const params: SimulationParams = {
        versionId: selectedVersion,
        rentModel,
        adjustmentFR,
        adjustmentIB,
        targetEbitda: targetEbitda || undefined,
        years: {
          start: startYear,
          end: endYear
        }
      }

      const response = await fetch('/api/tuition-simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Simulation failed')
      }

      const data = await response.json()
      setResults(data.results || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Calculate summary stats
  const avgEbitda = results.length > 0
    ? results.reduce((sum, r) => sum + r.ebitda, 0) / results.length
    : 0

  const avgMargin = results.length > 0
    ? results.reduce((sum, r) => sum + r.ebitdaMarginPct, 0) / results.length
    : 0

  const avgRentLoad = results.length > 0
    ? results.reduce((sum, r) => sum + r.rentLoadPct, 0) / results.length
    : 0

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tuition Simulator</h1>
        <p className="text-sm text-gray-600 mt-1">
          Rent-driven simulation to maintain target EBITDA
        </p>
      </div>

      {/* Configuration Panel */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Simulation Parameters
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Version Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Version
            </label>
            <select
              value={selectedVersion}
              onChange={e => setSelectedVersion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {versions.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.status})
                </option>
              ))}
            </select>
          </div>

          {/* Rent Model */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rent Model
            </label>
            <select
              value={rentModel}
              onChange={e => setRentModel(e.target.value as RentModelType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="FixedEscalation">Fixed Escalation</option>
              <option value="RevenueShare">Revenue Share</option>
              <option value="PartnerModel">Partner Model</option>
            </select>
          </div>

          {/* Year Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Year
              </label>
              <input
                type="number"
                value={startYear}
                onChange={e => setStartYear(parseInt(e.target.value))}
                min={2023}
                max={2052}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Year
              </label>
              <input
                type="number"
                value={endYear}
                onChange={e => setEndYear(parseInt(e.target.value))}
                min={2023}
                max={2052}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Tuition Adjustments */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Tuition Adjustments
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                French Curriculum (%)
              </label>
              <input
                type="number"
                value={adjustmentFR}
                onChange={e => setAdjustmentFR(parseFloat(e.target.value))}
                min={-20}
                max={50}
                step={0.1}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Range: -20% to +50%
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                IB Curriculum (%)
              </label>
              <input
                type="number"
                value={adjustmentIB}
                onChange={e => setAdjustmentIB(parseFloat(e.target.value))}
                min={-20}
                max={50}
                step={0.1}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Range: -20% to +50%
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target EBITDA (optional)
              </label>
              <input
                type="number"
                value={targetEbitda}
                onChange={e => setTargetEbitda(parseFloat(e.target.value))}
                min={0}
                step={1000}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave 0 for no target
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          <button
            onClick={handleRunSimulation}
            disabled={loading || !selectedVersion}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Running Simulation...' : 'Run Simulation'}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
      </div>

      {/* Results Summary */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-xs text-blue-700 font-medium uppercase">
              Avg EBITDA
            </div>
            <div className="text-2xl font-bold text-blue-900 mt-1">
              ${avgEbitda.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-xs text-green-700 font-medium uppercase">
              Avg Margin
            </div>
            <div className="text-2xl font-bold text-green-900 mt-1">
              {avgMargin.toFixed(1)}%
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-xs text-purple-700 font-medium uppercase">
              Avg Rent Load
            </div>
            <div className="text-2xl font-bold text-purple-900 mt-1">
              {avgRentLoad.toFixed(1)}%
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="text-xs text-orange-700 font-medium uppercase">
              Years Simulated
            </div>
            <div className="text-2xl font-bold text-orange-900 mt-1">
              {results.length}
            </div>
          </div>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Simulation Results
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Year
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Students
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Tuition FR
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Tuition IB
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Revenue
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Rent
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    COGS
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    EBITDA
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Margin %
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Rent Load %
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {results.map(result => (
                  <tr key={result.year} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {result.year}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                      {result.students.total.toLocaleString()}
                      <span className="text-xs text-gray-400 ml-1">
                        ({result.students.fr}+{result.students.ib})
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                      ${result.tuition.fr.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                      ${result.tuition.ib.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      ${result.revenue.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                      ${result.rent.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                      ${result.cogs.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                      ${result.ebitda.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          result.ebitdaMarginPct >= 20
                            ? 'bg-green-100 text-green-800'
                            : result.ebitdaMarginPct >= 10
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {result.ebitdaMarginPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                      {result.rentLoadPct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {results.length === 0 && !loading && !error && (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Simulation Results
          </h3>
          <p className="text-sm text-gray-500">
            Configure parameters above and click "Run Simulation" to see results
          </p>
        </div>
      )}
    </main>
  )
}
