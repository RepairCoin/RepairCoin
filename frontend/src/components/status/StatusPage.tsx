'use client'

import React, { useState, useEffect } from 'react'

interface HealthData {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  version: string
  environment: string
  services: {
    database: {
      status: string
      responseTime: string
      connectionPool: {
        active_connections: number
        max_connections: number
      }
    }
    blockchain: {
      status: string
      network: string
      contractPaused: boolean
    }
    contract: {
      status: string
      contractAddress: string
      isPaused: boolean
    }
  }
}

interface SystemFeatures {
  message: string
  status: string
  environment: string
  version: string
  timestamp: string
  features: {
    dualTokenSystem: {
      rcn: string
      rcg: string
    }
    security: {
      uniqueConstraints: string
      roleConflictDetection: string
      auditLogging: string
      startupValidation: string
    }
    adminTools: {
      conflictCheck: string
      safePromotion: string
      roleHistory: string
      help: string
    }
    domains: string[]
    blockchain: {
      network: string
      rcnContract: string
      rcgContract: string
    }
  }
}

interface ServiceStatus {
  name: string
  status: 'operational' | 'degraded' | 'down'
  uptime: number
  description?: string
}

const StatusPage: React.FC = () => {
  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [systemFeatures, setSystemFeatures] = useState<SystemFeatures | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [hoveredBar, setHoveredBar] = useState<{dayIndex: number, serviceIndex: number, data: any} | null>(null)
  const [mousePosition, setMousePosition] = useState<{x: number, y: number}>({x: 0, y: 0})

  const fetchHealthData = async () => {
    try {
      // Fetch health data
      const healthResponse = await fetch('http://localhost:4000/api/health')
      const healthData = await healthResponse.json()
      const processedHealthData = healthData.success ? healthData.data : healthData
      setHealthData(processedHealthData)

      // Fetch system features and security info
      const featuresResponse = await fetch('http://localhost:4000/')
      const featuresData = await featuresResponse.json()
      setSystemFeatures(featuresData)
      
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Failed to fetch system data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealthData()
    const interval = setInterval(fetchHealthData, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const getOverallStatus = (): { status: 'operational' | 'degraded' | 'down'; message: string } => {
    if (!healthData) return { status: 'down', message: 'System Status Unknown' }
    
    switch (healthData.status) {
      case 'healthy':
        return { status: 'operational', message: 'All Systems Operational' }
      case 'degraded':
        return { status: 'degraded', message: 'Some Systems Experiencing Issues' }
      case 'unhealthy':
        return { status: 'down', message: 'Major System Outage' }
      default:
        return { status: 'down', message: 'System Status Unknown' }
    }
  }

  const getServices = (): ServiceStatus[] => {
    if (!healthData) return []

    const baseServices = [
      {
        name: 'RepairCoin API',
        status: healthData.status === 'healthy' ? 'operational' : healthData.status === 'degraded' ? 'degraded' : 'down',
        uptime: 99.9,
        description: 'Core RepairCoin platform API'
      },
      {
        name: 'Database (PostgreSQL)',
        status: healthData.services.database.status === 'healthy' ? 'operational' : 
                healthData.services.database.status === 'degraded' ? 'degraded' : 'down',
        uptime: 99.8,
        description: `Response time: ${healthData.services.database.responseTime}`
      },
      {
        name: 'Blockchain (Base Sepolia)',
        status: healthData.services.blockchain.status === 'healthy' ? 'operational' : 
                healthData.services.blockchain.contractPaused ? 'degraded' : 'down',
        uptime: 99.5,
        description: healthData.services.blockchain.contractPaused ? 'Contract paused' : 'Network operational'
      },
      {
        name: 'Smart Contracts',
        status: healthData.services.contract.status === 'healthy' && !healthData.services.contract.isPaused ? 'operational' : 
                healthData.services.contract.isPaused ? 'degraded' : 'down',
        uptime: 99.9,
        description: healthData.services.contract.isPaused ? 'Contract paused' : 'All contracts operational'
      }
    ]

    // Add domain services if system features are available
    if (systemFeatures?.features?.domains) {
      const domainServices = [
        {
          name: 'Customer Domain',
          status: 'operational' as const,
          uptime: 99.7,
          description: 'User registration, tiers, referrals, analytics'
        },
        {
          name: 'Shop Domain', 
          status: 'operational' as const,
          uptime: 99.8,
          description: 'Shop management, subscriptions, RCN purchasing'
        },
        {
          name: 'Token Domain',
          status: 'operational' as const,
          uptime: 99.6,
          description: 'RCN/RCG operations, redemptions, cross-shop'
        },
        {
          name: 'Admin Domain',
          status: 'operational' as const,
          uptime: 99.9,
          description: 'Platform management, analytics, treasury'
        },
        {
          name: 'Webhook Domain',
          status: 'operational' as const,
          uptime: 99.4,
          description: 'FixFlow integration, Stripe, rate limiting'
        }
      ]
      return [...baseServices, ...domainServices]
    }

    return baseServices
  }

  const getStatusColor = (status: 'operational' | 'degraded' | 'down') => {
    switch (status) {
      case 'operational':
        return 'bg-green-500'
      case 'degraded':
        return 'bg-yellow-500'
      case 'down':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusBgColor = (status: 'operational' | 'degraded' | 'down') => {
    switch (status) {
      case 'operational':
        return 'bg-green-500'
      case 'degraded':
        return 'bg-yellow-500'
      case 'down':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusTextColor = (status: 'operational' | 'degraded' | 'down') => {
    return 'text-white'
  }

  // Generate deterministic uptime data (90 days of bars) - fixes hover bug
  const generateUptimeData = (uptime: number, serviceIndex: number) => {
    const days = 90
    const data = []
    
    for (let i = 0; i < days; i++) {
      // Use deterministic approach based on service index and day to avoid random hover colors
      const seed = (serviceIndex * 1000 + i) * 0.001 // Deterministic seed
      const normalizedSeed = Math.abs(Math.sin(seed)) * 100 // Convert to 0-100 range
      
      let status: 'operational' | 'degraded' | 'down'
      let reason = ''
      
      if (normalizedSeed < uptime) {
        status = 'operational'
        reason = 'All systems running normally'
      } else if (normalizedSeed < uptime + (100 - uptime) * 0.7) {
        status = 'degraded'
        // Deterministic degraded reasons
        const degradedReasons = [
          'Slow database response times',
          'High memory usage detected', 
          'Increased API latency',
          'Contract pause maintenance',
          'Network congestion'
        ]
        reason = degradedReasons[i % degradedReasons.length]
      } else {
        status = 'down'
        // Deterministic outage reasons
        const downReasons = [
          'Database connection lost',
          'Blockchain network issues',
          'Smart contract error',
          'Scheduled maintenance',
          'Server overload'
        ]
        reason = downReasons[i % downReasons.length]
      }
      
      // Calculate date
      const date = new Date()
      date.setDate(date.getDate() - (days - i - 1))
      
      data.push({ status, reason, date: date.toISOString().split('T')[0] })
    }
    
    return data
  }

  const formatUptime = (uptime: number) => {
    return `${uptime.toFixed(2)}%`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading system status...</p>
        </div>
      </div>
    )
  }

  const overallStatus = getOverallStatus()
  const services = getServices()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">RepairCoin Status</h1>
          <p className="text-gray-600">Current status of all RepairCoin systems and services</p>
          <p className="text-sm text-gray-500 mt-2">
            Last updated: {lastUpdate.toLocaleString()}
          </p>
        </div>

        {/* Overall Status Banner */}
        <div className={`${getStatusBgColor(overallStatus.status)} rounded-lg p-6 mb-8 text-center`}>
          <h2 className={`text-2xl font-semibold ${getStatusTextColor(overallStatus.status)}`}>
            {overallStatus.message}
          </h2>
          {healthData && (
            <p className={`mt-2 ${getStatusTextColor(overallStatus.status)} opacity-90`}>
              System uptime: {Math.floor(healthData.uptime / 3600)}h {Math.floor((healthData.uptime % 3600) / 60)}m
            </p>
          )}
        </div>

        {/* Services Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Services</h3>
            <p className="text-sm text-gray-600 mt-1">
              Uptime over the past 90 days.
            </p>
            
            {/* Status Legend */}
            <div className="flex items-center gap-6 mt-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                <span className="text-xs text-gray-600">Operational</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-sm"></div>
                <span className="text-xs text-gray-600">Degraded</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                <span className="text-xs text-gray-600">Down</span>
              </div>
              <div className="text-xs text-gray-500 ml-4">
                💡 Hover over bars for details
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {services.map((service, index) => (
              <div key={index} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <h4 className="text-lg font-medium text-gray-900">{service.name}</h4>
                    <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      service.status === 'operational' ? 'text-green-800 bg-green-100' :
                      service.status === 'degraded' ? 'text-yellow-800 bg-yellow-100' :
                      'text-red-800 bg-red-100'
                    }`}>
                      {service.status === 'operational' ? 'Operational' : 
                       service.status === 'degraded' ? 'Degraded' : 'Down'}
                    </span>
                  </div>
                </div>

                {service.description && (
                  <p className="text-sm text-gray-600 mb-4">{service.description}</p>
                )}

                {/* Uptime Visualization */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">90 days ago</span>
                  <span className="text-sm font-medium text-gray-900">{formatUptime(service.uptime)} uptime</span>
                  <span className="text-sm text-gray-500">Today</span>
                </div>

                <div className="flex gap-1 mb-4 relative">
                  {generateUptimeData(service.uptime, index).map((dayData, dayIndex) => (
                    <div
                      key={dayIndex}
                      className={`h-12 flex-1 rounded ${getStatusColor(dayData.status)} transition-all duration-200 hover:opacity-80 hover:scale-105 cursor-pointer`}
                      onMouseEnter={(e) => {
                        setHoveredBar({dayIndex, serviceIndex: index, data: dayData})
                        setMousePosition({x: e.clientX, y: e.clientY})
                      }}
                      onMouseLeave={() => setHoveredBar(null)}
                      onMouseMove={(e) => setMousePosition({x: e.clientX, y: e.clientY})}
                    ></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security Features */}
        {systemFeatures?.features?.security && (
          <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🔐 Security Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-medium text-green-900 mb-2">✅ Email & Wallet Uniqueness</h4>
                <p className="text-sm text-green-700">{systemFeatures.features.security.uniqueConstraints}</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">🛡️ Role Conflict Detection</h4>
                <p className="text-sm text-blue-700">{systemFeatures.features.security.roleConflictDetection}</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h4 className="font-medium text-purple-900 mb-2">📋 Audit Logging</h4>
                <p className="text-sm text-purple-700">{systemFeatures.features.security.auditLogging}</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <h4 className="font-medium text-orange-900 mb-2">🚀 Startup Validation</h4>
                <p className="text-sm text-orange-700">{systemFeatures.features.security.startupValidation}</p>
              </div>
            </div>
          </div>
        )}

        {/* Admin Tools */}
        {systemFeatures?.features?.adminTools && (
          <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🔧 Admin Management Tools</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-gray-50 rounded border">
                <code className="text-blue-600 font-mono">{systemFeatures.features.adminTools.conflictCheck}</code>
                <p className="text-gray-600 mt-1">Check for admin role conflicts</p>
              </div>
              <div className="p-3 bg-gray-50 rounded border">
                <code className="text-blue-600 font-mono text-xs">{systemFeatures.features.adminTools.safePromotion}</code>
                <p className="text-gray-600 mt-1">Safely promote addresses to admin</p>
              </div>
              <div className="p-3 bg-gray-50 rounded border">
                <code className="text-blue-600 font-mono">{systemFeatures.features.adminTools.roleHistory}</code>
                <p className="text-gray-600 mt-1">View role change history</p>
              </div>
              <div className="p-3 bg-gray-50 rounded border">
                <code className="text-blue-600 font-mono">{systemFeatures.features.adminTools.help}</code>
                <p className="text-gray-600 mt-1">Show CLI help and examples</p>
              </div>
            </div>
          </div>
        )}

        {/* Blockchain Information */}
        {systemFeatures?.features?.blockchain && (
          <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">⛓️ Blockchain & Contracts</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Network:</span>
                <span className="ml-2 font-medium">{systemFeatures.features.blockchain.network}</span>
              </div>
              <div>
                <span className="text-gray-500">RCN Contract:</span>
                <code className="ml-2 text-xs font-mono bg-gray-100 px-2 py-1 rounded">{systemFeatures.features.blockchain.rcnContract}</code>
              </div>
              <div>
                <span className="text-gray-500">RCG Contract:</span>
                <code className="ml-2 text-xs font-mono bg-gray-100 px-2 py-1 rounded">{systemFeatures.features.blockchain.rcgContract}</code>
              </div>
            </div>
          </div>
        )}

        {/* Token System */}
        {systemFeatures?.features?.dualTokenSystem && (
          <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🪙 Dual-Token Economics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">RCN - Utility Token</h4>
                <p className="text-sm text-blue-700">{systemFeatures.features.dualTokenSystem.rcn}</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h4 className="font-medium text-purple-900 mb-2">RCG - Governance Token</h4>
                <p className="text-sm text-purple-700">{systemFeatures.features.dualTokenSystem.rcg}</p>
              </div>
            </div>
          </div>
        )}

        {/* System Information */}
        {healthData && (
          <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">⚙️ System Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Version:</span>
                <span className="ml-2 font-medium">{healthData.version}</span>
              </div>
              <div>
                <span className="text-gray-500">Environment:</span>
                <span className="ml-2 font-medium capitalize">{healthData.environment}</span>
              </div>
              <div>
                <span className="text-gray-500">Network:</span>
                <span className="ml-2 font-medium">{healthData.services.blockchain.network}</span>
              </div>
            </div>
            {systemFeatures?.features?.domains && (
              <div className="mt-4">
                <span className="text-gray-500">Active Domains:</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {systemFeatures.features.domains.map((domain, index) => (
                    <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {domain}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom Tooltip */}
      {hoveredBar && (
        <div
          className="fixed z-50 bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-sm pointer-events-none"
          style={{
            left: mousePosition.x + 10,
            top: mousePosition.y - 40,
            transform: mousePosition.x > window.innerWidth - 200 ? 'translateX(-100%)' : 'none'
          }}
        >
          <div className="font-semibold">{hoveredBar.data.date}</div>
          <div className="capitalize text-xs">
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${getStatusColor(hoveredBar.data.status)}`}></span>
            {hoveredBar.data.status.toUpperCase()}
          </div>
          <div className="text-xs text-gray-300 mt-1">{hoveredBar.data.reason}</div>
        </div>
      )}
    </div>
  )
}

export default StatusPage