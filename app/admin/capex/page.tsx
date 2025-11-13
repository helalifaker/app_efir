'use client'

/**
 * Admin Capex Configuration Page
 * Manage capex auto-reinvestment rules by asset class
 */

import { useState, useEffect } from 'react'

// ============================================================================
// TYPES
// ============================================================================

type AssetClass = 'Building' | 'FF&E' | 'IT' | 'Other'
type TriggerType = 'cycle' | 'utilization' | 'both'

interface CapexRule {
  id?: string
  class: AssetClass
  cycle_years: number
  inflation_index: string
  base_cost: number
  trigger_type: TriggerType
  utilization_threshold?: number
  created_by?: string
  created_at?: string
  updated_at?: string
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AdminCapexPage() {
  const [rules, setRules] = useState<CapexRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingRule, setEditingRule] = useState<CapexRule | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Load capex rules
  useEffect(() => {
    fetchRules()
  }, [])

  async function fetchRules() {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/capex-rules')

      if (!response.ok) {
        throw new Error('Failed to fetch capex rules')
      }

      const data = await response.json()
      setRules(data.rules || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Open modal for creating new rule
  function handleCreateNew() {
    setEditingRule({
      class: 'Building',
      cycle_years: 20,
      inflation_index: 'CPI',
      base_cost: 0,
      trigger_type: 'cycle'
    })
    setIsModalOpen(true)
  }

  // Open modal for editing existing rule
  function handleEdit(rule: CapexRule) {
    setEditingRule({ ...rule })
    setIsModalOpen(true)
  }

  // Save rule (create or update)
  async function handleSave() {
    if (!editingRule) return

    try {
      const isNew = !editingRule.id

      const response = await fetch('/api/admin/capex-rules', {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRule)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Save failed')
      }

      setIsModalOpen(false)
      setEditingRule(null)
      await fetchRules()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  // Delete rule
  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this capex rule?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/capex-rules?id=${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Delete failed')
      }

      await fetchRules()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  // Get default cycle years for asset class
  function getDefaultCycleYears(assetClass: AssetClass): number {
    switch (assetClass) {
      case 'Building':
        return 20
      case 'FF&E':
        return 7
      case 'IT':
        return 4
      case 'Other':
        return 10
    }
  }

  // Update editing rule field
  function updateField(field: keyof CapexRule, value: any) {
    if (!editingRule) return

    const updated = { ...editingRule, [field]: value }

    // Auto-set cycle years when changing asset class
    if (field === 'class') {
      updated.cycle_years = getDefaultCycleYears(value as AssetClass)
    }

    setEditingRule(updated)
  }

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Capex Configuration
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage auto-reinvestment rules by asset class
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          + New Rule
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Rules Table */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="text-gray-500">Loading capex rules...</div>
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-500 mb-4">No capex rules configured</p>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create First Rule
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Asset Class
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Cycle (Years)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Inflation Index
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Base Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Trigger Type
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Utilization %
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rules.map(rule => (
                <tr key={rule.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      {rule.class}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {rule.cycle_years}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {rule.inflation_index}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    ${rule.base_cost.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {rule.trigger_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">
                    {rule.utilization_threshold || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={() => handleEdit(rule)}
                      className="text-blue-600 hover:text-blue-800 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => rule.id && handleDelete(rule.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Asset Class Reference */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">
          Default Cycles
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-blue-800">
          <div>
            <span className="font-medium">Building:</span> 20 years
          </div>
          <div>
            <span className="font-medium">FF&E:</span> 7 years
          </div>
          <div>
            <span className="font-medium">IT:</span> 4 years
          </div>
          <div>
            <span className="font-medium">Other:</span> Custom
          </div>
        </div>
      </div>

      {/* Edit/Create Modal */}
      {isModalOpen && editingRule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingRule.id ? 'Edit' : 'Create'} Capex Rule
              </h2>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Asset Class */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Asset Class *
                </label>
                <select
                  value={editingRule.class}
                  onChange={e =>
                    updateField('class', e.target.value as AssetClass)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Building">Building</option>
                  <option value="FF&E">FF&E</option>
                  <option value="IT">IT</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Cycle Years */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cycle (Years) *
                </label>
                <input
                  type="number"
                  value={editingRule.cycle_years}
                  onChange={e =>
                    updateField('cycle_years', parseInt(e.target.value))
                  }
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Inflation Index */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Inflation Index *
                </label>
                <input
                  type="text"
                  value={editingRule.inflation_index}
                  onChange={e => updateField('inflation_index', e.target.value)}
                  placeholder="e.g., CPI"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Base Cost */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Base Cost *
                </label>
                <input
                  type="number"
                  value={editingRule.base_cost}
                  onChange={e =>
                    updateField('base_cost', parseFloat(e.target.value))
                  }
                  min={0}
                  step={1000}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Trigger Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trigger Type *
                </label>
                <select
                  value={editingRule.trigger_type}
                  onChange={e =>
                    updateField('trigger_type', e.target.value as TriggerType)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cycle">Cycle (Time-based)</option>
                  <option value="utilization">Utilization (Usage-based)</option>
                  <option value="both">Both</option>
                </select>
              </div>

              {/* Utilization Threshold */}
              {(editingRule.trigger_type === 'utilization' ||
                editingRule.trigger_type === 'both') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Utilization Threshold (%) *
                  </label>
                  <input
                    type="number"
                    value={editingRule.utilization_threshold || 0}
                    onChange={e =>
                      updateField(
                        'utilization_threshold',
                        parseFloat(e.target.value)
                      )
                    }
                    min={0}
                    max={100}
                    step={0.1}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Trigger reinvestment when utilization exceeds this percentage
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  setEditingRule(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
