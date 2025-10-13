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

interface ServiceStatus {
  name: string
  status: 'operational' | 'degraded' | 'down'
  uptime: number
  description?: string
}

const StatusPage: React.FC = () => {
  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [hoveredBar, setHoveredBar] = useState<{dayIndex: number, serviceIndex: number, data: any} | null>(null)
  const [mousePosition, setMousePosition] = useState<{x: number, y: number}>({x: 0, y: 0})

  const fetchHealthData = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/health')
      const data = await response.json()
      // Handle the wrapped response format
      const healthData = data.success ? data.data : data
      setHealthData(healthData)
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Failed to fetch health data:', error)
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

    return [
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

  // Generate mock uptime data (90 days of bars)
  const generateUptimeData = (uptime: number) => {
    const days = 90
    const data = []
    
    for (let i = 0; i < days; i++) {
      // Simulate occasional issues based on uptime percentage
      const rand = Math.random() * 100
      let status: 'operational' | 'degraded' | 'down'
      let reason = ''
      
      if (rand < uptime) {
        status = 'operational'
        reason = 'All systems running normally'
      } else if (rand < uptime + (100 - uptime) * 0.7) {
        status = 'degraded'
        // Random degraded reasons
        const degradedReasons = [
          'Slow database response times',
          'High memory usage detected',
          'Increased API latency',
          'Contract pause maintenance',
          'Network congestion'
        ]
        reason = degradedReasons[Math.floor(Math.random() * degradedReasons.length)]
      } else {
        status = 'down'
        // Random outage reasons
        const downReasons = [
          'Database connection lost',
          'Blockchain network issues',
          'Smart contract error',
          'Scheduled maintenance',
          'Server overload'
        ]
        reason = downReasons[Math.floor(Math.random() * downReasons.length)]
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
                    <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-green-800 bg-green-100`}>
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
                  {generateUptimeData(service.uptime).map((dayData, dayIndex) => (
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

        {/* System Information */}
        {healthData && (
          <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">System Information</h3>
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