'use client'

/**
 * Rent Lens Component
 * Inline component showing rent model details, parameters, and projections
 */

import { useState, useEffect } from 'react'

// ============================================================================
// TYPES
// ============================================================================

type RentModelType = 'FixedEscalation' | 'RevenueShare' | 'PartnerModel'

interface RentPlan {
  id: string
  year: number
  model_type: RentModelType | null
  amount: number
  model_config: any
}

interface RentLensProps {
  versionId: string
  selectedYear?: number
  compact?: boolean
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function RentLens({
  versionId,
  selectedYear,
  compact = false
}: RentLensProps) {
  const [rentPlans, setRentPlans] = useState<RentPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedYear, setExpandedYear] = useState<number | null>(selectedYear || null)

  // Load rent data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const response = await fetch(`/api/versions/${versionId}/rent`)

        if (!response.ok) {
          throw new Error('Failed to fetch rent data')
        }

        const result = await response.json()
        setRentPlans(result.rent_plans || [])
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [versionId])

  // Get rent by period
  const historicalRent = rentPlans.filter(r => r.year >= 2023 && r.year <= 2024)
  const transitionRent = rentPlans.filter(r => r.year >= 2025 && r.year <= 2027)
  const relocationRent = rentPlans.filter(r => r.year >= 2028)

  // Render model parameters
  const renderModelParams = (modelType: RentModelType, config: any) => {
    switch (modelType) {
      case 'FixedEscalation':
        return (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Base Rent:</span>
              <span className="ml-2 font-medium">
                ${config.baseRent?.toLocaleString() || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Escalation Rate:</span>
              <span className="ml-2 font-medium">
                {((config.escalationRate || 0) * 100).toFixed(2)}%
              </span>
            </div>
            <div>
              <span className="text-gray-500">Frequency:</span>
              <span className="ml-2 font-medium">
                Every {config.escalationFrequency || 'N/A'} year(s)
              </span>
            </div>
          </div>
        )

      case 'RevenueShare':
        return (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Revenue Share:</span>
              <span className="ml-2 font-medium">
                {config.revenueSharePct?.toFixed(2) || 'N/A'}%
              </span>
            </div>
            {config.minimumRent && (
              <div>
                <span className="text-gray-500">Minimum:</span>
                <span className="ml-2 font-medium">
                  ${config.minimumRent.toLocaleString()}
                </span>
              </div>
            )}
            {config.maximumRent && (
              <div>
                <span className="text-gray-500">Maximum:</span>
                <span className="ml-2 font-medium">
                  ${config.maximumRent.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )

      case 'PartnerModel':
        const capexBase =
          (config.landSize || 0) * (config.landPricePerSqm || 0) +
          (config.buaSize || 0) * (config.buaPricePerSqm || 0)
        return (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="col-span-2">
              <span className="text-gray-500">Capex Base:</span>
              <span className="ml-2 font-medium">
                ${capexBase.toLocaleString()}
              </span>
              <span className="ml-2 text-xs text-gray-400">
                ({config.landSize?.toLocaleString() || 0} m² land @{' '}
                ${config.landPricePerSqm?.toLocaleString() || 0}/m² +{' '}
                {config.buaSize?.toLocaleString() || 0} m² BUA @{' '}
                ${config.buaPricePerSqm?.toLocaleString() || 0}/m²)
              </span>
            </div>
            <div>
              <span className="text-gray-500">Base Yield:</span>
              <span className="ml-2 font-medium">
                {config.yieldBase?.toFixed(2) || 'N/A'}%
              </span>
            </div>
            <div>
              <span className="text-gray-500">Yield Growth:</span>
              <span className="ml-2 font-medium">
                {((config.yieldGrowthRate || 0) * 100).toFixed(2)}% every{' '}
                {config.growthFrequency || 'N/A'}y
              </span>
            </div>
          </div>
        )

      default:
        return <div className="text-sm text-gray-500">No model configured</div>
    }
  }

  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-sm text-gray-500">Loading rent data...</div>
      </div>
    )
  }

  // Render error state
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    )
  }

  // Render compact view
  if (compact) {
    const currentModel = relocationRent[0]?.model_type
    const totalYears = rentPlans.length
    const avgRent =
      totalYears > 0
        ? rentPlans.reduce((sum, r) => sum + r.amount, 0) / totalYears
        : 0

    return (
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-4">
          <div>
            <div className="text-xs text-gray-500">Rent Model</div>
            <div className="text-sm font-medium">
              {currentModel || 'Not configured'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Avg Rent</div>
            <div className="text-sm font-medium">
              ${avgRent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Years</div>
            <div className="text-sm font-medium">{totalYears}</div>
          </div>
        </div>
        <button
          onClick={() => setExpandedYear(expandedYear ? null : rentPlans[0]?.year || null)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          {expandedYear ? 'Collapse' : 'Expand'}
        </button>
      </div>
    )
  }

  // Render full view
  return (
    <div className="space-y-4">
      {/* Period Sections */}
      {historicalRent.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">
              Historical (2023-2024)
            </h3>
          </div>
          <div className="p-4 space-y-2">
            {historicalRent.map(rent => (
              <div
                key={rent.year}
                className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
              >
                <span className="text-sm font-medium">{rent.year}</span>
                <span className="text-sm font-semibold text-gray-900">
                  ${rent.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {transitionRent.length > 0 && (
        <div className="border border-yellow-200 rounded-lg overflow-hidden">
          <div className="bg-yellow-50 px-4 py-2 border-b border-yellow-200">
            <h3 className="text-sm font-medium text-yellow-800">
              Transition (2025-2027)
            </h3>
            <p className="text-xs text-yellow-600 mt-1">
              Cloned from 2024 actuals
            </p>
          </div>
          <div className="p-4 space-y-2">
            {transitionRent.map(rent => (
              <div
                key={rent.year}
                className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
              >
                <span className="text-sm font-medium">{rent.year}</span>
                <span className="text-sm font-semibold text-gray-900">
                  ${rent.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {relocationRent.length > 0 && (
        <div className="border border-blue-200 rounded-lg overflow-hidden">
          <div className="bg-blue-50 px-4 py-2 border-b border-blue-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-medium text-blue-800">
                  Relocation (2028+)
                </h3>
                <p className="text-xs text-blue-600 mt-1">
                  Model: {relocationRent[0]?.model_type || 'Not set'}
                </p>
              </div>
            </div>
          </div>

          {/* Model Parameters */}
          {relocationRent[0]?.model_type && relocationRent[0]?.model_config && (
            <div className="bg-blue-25 px-4 py-3 border-b border-blue-100">
              <div className="text-xs font-medium text-blue-700 mb-2 uppercase">
                Model Parameters
              </div>
              {renderModelParams(
                relocationRent[0].model_type,
                relocationRent[0].model_config
              )}
            </div>
          )}

          {/* Rent Projection */}
          <div className="p-4 space-y-2">
            {relocationRent.slice(0, 10).map(rent => (
              <div
                key={rent.year}
                className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
              >
                <span className="text-sm font-medium">{rent.year}</span>
                <span className="text-sm font-semibold text-gray-900">
                  ${rent.amount.toLocaleString()}
                </span>
              </div>
            ))}
            {relocationRent.length > 10 && (
              <div className="text-center text-xs text-gray-500 pt-2">
                + {relocationRent.length - 10} more years
              </div>
            )}
          </div>

          {/* Summary Stats */}
          <div className="bg-gray-50 px-4 py-3 grid grid-cols-3 gap-4 border-t border-gray-200">
            <div>
              <div className="text-xs text-gray-500">First Year</div>
              <div className="text-sm font-medium">
                ${relocationRent[0]?.amount.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Last Year</div>
              <div className="text-sm font-medium">
                ${relocationRent[relocationRent.length - 1]?.amount.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Growth</div>
              <div className="text-sm font-medium">
                {relocationRent[0]?.amount && relocationRent[relocationRent.length - 1]?.amount
                  ? (
                      ((relocationRent[relocationRent.length - 1].amount -
                        relocationRent[0].amount) /
                        relocationRent[0].amount) *
                      100
                    ).toFixed(1)
                  : 0}
                %
              </div>
            </div>
          </div>
        </div>
      )}

      {rentPlans.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-gray-500">No rent data configured for this version</p>
        </div>
      )}
    </div>
  )
}
