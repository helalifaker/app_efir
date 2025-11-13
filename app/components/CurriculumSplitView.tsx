'use client'

/**
 * Curriculum Split View Component
 * Displays FR and IB curricula in tabs with editable data tables
 */

import { useState, useEffect } from 'react'

// ============================================================================
// TYPES
// ============================================================================

type CurriculumType = 'FR' | 'IB'

interface CurriculumPlan {
  id?: string
  curriculum_type: CurriculumType
  year: number
  capacity: number
  students: number
  tuition: number
  teacher_ratio: number
  non_teacher_ratio: number
  cpi_frequency: 1 | 2 | 3
  cpi_base_year: number
  created_at?: string
  updated_at?: string
}

interface CurriculumData {
  FR: CurriculumPlan[]
  IB: CurriculumPlan[]
}

interface CurriculumSplitViewProps {
  versionId: string
  editable?: boolean
  onDataChange?: (data: CurriculumData) => void
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function CurriculumSplitView({
  versionId,
  editable = false,
  onDataChange
}: CurriculumSplitViewProps) {
  const [activeTab, setActiveTab] = useState<CurriculumType>('FR')
  const [data, setData] = useState<CurriculumData>({ FR: [], IB: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<{
    year: number
    field: string
  } | null>(null)

  // Load curriculum data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const response = await fetch(`/api/versions/${versionId}/curriculum`)

        if (!response.ok) {
          throw new Error('Failed to fetch curriculum data')
        }

        const result = await response.json()
        setData(result.curricula || { FR: [], IB: [] })
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [versionId])

  // Handle cell edit
  const handleCellEdit = async (
    year: number,
    field: keyof CurriculumPlan,
    value: any
  ) => {
    const plan = data[activeTab].find(p => p.year === year)
    if (!plan) return

    // Update local state
    const updatedPlan = { ...plan, [field]: value }
    const updatedData = {
      ...data,
      [activeTab]: data[activeTab].map(p =>
        p.year === year ? updatedPlan : p
      )
    }
    setData(updatedData)
    onDataChange?.(updatedData)

    // Save to API if editable
    if (editable) {
      try {
        const response = await fetch(`/api/versions/${versionId}/curriculum`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedPlan)
        })

        if (!response.ok) {
          throw new Error('Failed to update curriculum plan')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed')
      }
    }

    setEditingCell(null)
  }

  // Calculate derived metrics
  const calculateUtilization = (students: number, capacity: number): string => {
    if (capacity === 0) return '0%'
    return `${((students / capacity) * 100).toFixed(1)}%`
  }

  const calculateRevenue = (students: number, tuition: number): string => {
    return (students * tuition).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    })
  }

  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading curriculum data...</div>
      </div>
    )
  }

  // Render error state
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    )
  }

  const currentData = data[activeTab]

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('FR')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'FR'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            French Curriculum
            {data.FR.length > 0 && (
              <span className="ml-2 text-xs text-gray-400">
                ({data.FR.length} years)
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('IB')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'IB'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            IB Curriculum
            {data.IB.length > 0 && (
              <span className="ml-2 text-xs text-gray-400">
                ({data.IB.length} years)
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Data Table */}
      {currentData.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-gray-500">
            No {activeTab} curriculum data for this version
          </p>
          {editable && (
            <button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              Add {activeTab} Data
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Year
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Capacity
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Students
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilization
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tuition
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Teacher Ratio
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CPI Freq
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentData.map(plan => (
                <tr key={plan.year} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {plan.year}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                    {plan.capacity.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                    {plan.students.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        parseFloat(calculateUtilization(plan.students, plan.capacity)) >= 90
                          ? 'bg-green-100 text-green-800'
                          : parseFloat(calculateUtilization(plan.students, plan.capacity)) >= 70
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {calculateUtilization(plan.students, plan.capacity)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                    ${plan.tuition.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                    {calculateRevenue(plan.students, plan.tuition)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                    {plan.teacher_ratio.toFixed(3)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                    {plan.cpi_frequency}y
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  Total
                </td>
                <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                  {currentData.reduce((sum, p) => sum + p.capacity, 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                  {currentData.reduce((sum, p) => sum + p.students, 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                  {calculateUtilization(
                    currentData.reduce((sum, p) => sum + p.students, 0),
                    currentData.reduce((sum, p) => sum + p.capacity, 0)
                  )}
                </td>
                <td colSpan={4} className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                  Total Revenue:{' '}
                  {currentData
                    .reduce((sum, p) => sum + p.students * p.tuition, 0)
                    .toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      minimumFractionDigits: 0
                    })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Summary Cards */}
      {currentData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-xs text-blue-600 font-medium uppercase">
              Avg Capacity
            </div>
            <div className="text-2xl font-bold text-blue-900 mt-1">
              {(
                currentData.reduce((sum, p) => sum + p.capacity, 0) /
                currentData.length
              ).toFixed(0)}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-xs text-green-600 font-medium uppercase">
              Avg Students
            </div>
            <div className="text-2xl font-bold text-green-900 mt-1">
              {(
                currentData.reduce((sum, p) => sum + p.students, 0) /
                currentData.length
              ).toFixed(0)}
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-xs text-purple-600 font-medium uppercase">
              Avg Tuition
            </div>
            <div className="text-2xl font-bold text-purple-900 mt-1">
              $
              {(
                currentData.reduce((sum, p) => sum + p.tuition, 0) /
                currentData.length
              ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-xs text-orange-600 font-medium uppercase">
              Avg Utilization
            </div>
            <div className="text-2xl font-bold text-orange-900 mt-1">
              {calculateUtilization(
                currentData.reduce((sum, p) => sum + p.students, 0),
                currentData.reduce((sum, p) => sum + p.capacity, 0)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
