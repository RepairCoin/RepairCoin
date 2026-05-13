"use client";

import { useState, useEffect } from "react";
import { inventoryApi } from "@/services/api/inventory";
import type {
  InventoryOverviewAnalytics,
  InventoryTurnoverAnalytics,
  ProfitMarginAnalytics,
  StockTrendAnalytics,
  LowStockForecastAnalytics,
} from "@/types/inventory";
import { toast } from "react-hot-toast";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  AlertTriangle,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Clock,
  CheckCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface InventoryAnalyticsTabProps {
  shopId: string;
}

const COLORS = ["#FFCC00", "#FF9800", "#4CAF50", "#2196F3", "#9C27B0", "#F44336", "#00BCD4", "#795548"];

export function InventoryAnalyticsTab({ shopId }: InventoryAnalyticsTabProps) {
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"overview" | "turnover" | "margins" | "trends" | "forecast">("overview");
  const [overviewPeriod, setOverviewPeriod] = useState(30);
  const [turnoverPeriod, setTurnoverPeriod] = useState(90);
  const [trendsPeriod, setTrendsPeriod] = useState(30);
  const [forecastDays, setForecastDays] = useState(7);

  const [overviewData, setOverviewData] = useState<InventoryOverviewAnalytics | null>(null);
  const [turnoverData, setTurnoverData] = useState<InventoryTurnoverAnalytics | null>(null);
  const [marginData, setMarginData] = useState<ProfitMarginAnalytics | null>(null);
  const [trendData, setTrendData] = useState<StockTrendAnalytics | null>(null);
  const [forecastData, setForecastData] = useState<LowStockForecastAnalytics | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [shopId, overviewPeriod, turnoverPeriod, trendsPeriod, forecastDays]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [overview, turnover, margins, trends, forecast] = await Promise.all([
        inventoryApi.getOverviewAnalytics(shopId, overviewPeriod),
        inventoryApi.getTurnoverAnalytics(shopId, turnoverPeriod),
        inventoryApi.getProfitMarginAnalytics(shopId),
        inventoryApi.getStockTrendAnalytics(shopId, trendsPeriod),
        inventoryApi.getLowStockForecast(shopId, forecastDays),
      ]);

      setOverviewData(overview);
      setTurnoverData(turnover);
      setMarginData(margins);
      setTrendData(trends);
      setForecastData(forecast);
    } catch (error) {
      console.error("Error loading analytics:", error);
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Inventory Analytics</h2>
        <p className="text-sm text-gray-600 mt-1">Gain insights into your inventory performance</p>
      </div>

      {/* Section Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {[
            { id: "overview", label: "Overview", icon: BarChart3 },
            { id: "turnover", label: "Turnover", icon: Activity },
            { id: "margins", label: "Profit Margins", icon: DollarSign },
            { id: "trends", label: "Stock Trends", icon: TrendingUp },
            { id: "forecast", label: "Forecast", icon: Clock },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors whitespace-nowrap ${
                  activeSection === tab.id
                    ? "border-b-2 border-[#FFCC00] text-[#FFCC00]"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Overview Section */}
      {activeSection === "overview" && overviewData && (
        <div className="space-y-6">
          {/* Period Selector */}
          <div className="flex justify-end">
            <select
              value={overviewPeriod}
              onChange={(e) => setOverviewPeriod(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Items</p>
                  <p className="text-2xl font-bold text-gray-900">{overviewData.totalItems}</p>
                  <p className="text-xs text-green-600 mt-1">{overviewData.availableItems} available</p>
                </div>
                <Package className="w-8 h-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Value</p>
                  <p className="text-2xl font-bold text-gray-900">${overviewData.totalValue.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">Cost: ${overviewData.totalCost.toFixed(2)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Potential Profit</p>
                  <p className="text-2xl font-bold text-green-600">${overviewData.potentialProfit.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">{overviewData.profitMargin.toFixed(1)}% margin</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Low/Out of Stock</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {overviewData.lowStockItems + overviewData.outOfStockItems}
                  </p>
                  <p className="text-xs text-orange-600 mt-1">
                    {overviewData.outOfStockItems} out of stock
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-orange-500" />
              </div>
            </div>
          </div>

          {/* Top Items */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Items by Value</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={overviewData.topItems}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                <Bar dataKey="value" fill="#FFCC00" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Breakdown</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={300}>
                <RePieChart>
                  <Pie
                    data={overviewData.categoryBreakdown}
                    dataKey="totalValue"
                    nameKey="categoryName"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry) => `${entry.categoryName}: $${entry.totalValue.toFixed(0)}`}
                  >
                    {overviewData.categoryBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                </RePieChart>
              </ResponsiveContainer>

              <div className="space-y-2">
                {overviewData.categoryBreakdown.map((cat, index) => (
                  <div key={cat.categoryId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="font-medium text-gray-900">{cat.categoryName}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">${cat.totalValue.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">{cat.itemCount} items</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Turnover Section */}
      {activeSection === "turnover" && turnoverData && (
        <div className="space-y-6">
          {/* Period Selector */}
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{turnoverData.summary.fastMoving}</p>
                <p className="text-sm text-gray-600">Fast Moving</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{turnoverData.summary.moderate}</p>
                <p className="text-sm text-gray-600">Moderate</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{turnoverData.summary.slowMoving}</p>
                <p className="text-sm text-gray-600">Slow Moving</p>
              </div>
            </div>

            <select
              value={turnoverPeriod}
              onChange={(e) => setTurnoverPeriod(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
            >
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
              <option value={180}>Last 6 months</option>
            </select>
          </div>

          {/* Turnover Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory Turnover Ratio</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={turnoverData.items.slice(0, 15)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="turnoverRatio" fill="#4CAF50" name="Turnover Ratio" />
                <Bar dataKey="daysToSell" fill="#FF9800" name="Days to Sell" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Turnover Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Classification</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sales Count</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Units Sold</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Turnover Ratio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {turnoverData.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      {item.sku && <div className="text-xs text-gray-500">SKU: {item.sku}</div>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          item.classification === "fast"
                            ? "bg-green-100 text-green-700"
                            : item.classification === "moderate"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {item.classification.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">{item.salesCount}</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">{item.unitsSold}</td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                      {item.turnoverRatio.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Profit Margins Section */}
      {activeSection === "margins" && marginData && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">High Margin Items</p>
              <p className="text-2xl font-bold text-green-600">{marginData.summary.highMargin}</p>
              <p className="text-xs text-gray-500 mt-1">&gt;50% margin</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Medium Margin Items</p>
              <p className="text-2xl font-bold text-orange-600">{marginData.summary.mediumMargin}</p>
              <p className="text-xs text-gray-500 mt-1">25-50% margin</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Low Margin Items</p>
              <p className="text-2xl font-bold text-red-600">{marginData.summary.lowMargin}</p>
              <p className="text-xs text-gray-500 mt-1">&lt;25% margin</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Avg Margin</p>
              <p className="text-2xl font-bold text-gray-900">{marginData.summary.avgMarginPercentage.toFixed(1)}%</p>
              <p className="text-xs text-gray-500 mt-1">Across all items</p>
            </div>
          </div>

          {/* Profit Margin Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Profit Margin Analysis</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={marginData.items.slice(0, 15)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="marginPercentage" fill="#4CAF50" name="Margin %" />
                <Bar yAxisId="right" dataKey="potentialProfit" fill="#FFCC00" name="Potential Profit ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Margin Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Profit</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Margin %</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {marginData.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">${item.price.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">${item.cost.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-green-600">
                      ${item.unitProfit.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          item.marginClassification === "high"
                            ? "bg-green-100 text-green-700"
                            : item.marginClassification === "medium"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {item.marginPercentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">{item.stockQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Trends Section */}
      {activeSection === "trends" && trendData && (
        <div className="space-y-6">
          {/* Period Selector */}
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{trendData.summary.totalAdded}</p>
                <p className="text-sm text-gray-600">Added</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{trendData.summary.totalRemoved}</p>
                <p className="text-sm text-gray-600">Removed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{trendData.summary.netChange}</p>
                <p className="text-sm text-gray-600">Net Change</p>
              </div>
            </div>

            <select
              value={trendsPeriod}
              onChange={(e) => setTrendsPeriod(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>

          {/* Trend Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Movement Trends</h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={trendData.trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="added" stroke="#4CAF50" name="Added" strokeWidth={2} />
                <Line type="monotone" dataKey="removed" stroke="#F44336" name="Removed" strokeWidth={2} />
                <Line type="monotone" dataKey="netChange" stroke="#2196F3" name="Net Change" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Forecast Section */}
      {activeSection === "forecast" && forecastData && (
        <div className="space-y-6">
          {/* Period Selector */}
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{forecastData.summary.critical}</p>
                <p className="text-sm text-gray-600">Critical</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{forecastData.summary.high}</p>
                <p className="text-sm text-gray-600">High Priority</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{forecastData.summary.moderate}</p>
                <p className="text-sm text-gray-600">Moderate</p>
              </div>
            </div>

            <select
              value={forecastDays}
              onChange={(e) => setForecastDays(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
            >
              <option value={7}>Next 7 days</option>
              <option value={14}>Next 14 days</option>
              <option value={30}>Next 30 days</option>
              <option value={60}>Next 60 days</option>
            </select>
          </div>

          {/* Forecast Table */}
          {forecastData.items.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">All Good!</h3>
              <p className="text-gray-600">
                No items are predicted to run out in the next {forecastDays} days
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Avg Daily Usage</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Days Until Stockout</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estimated Date</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Urgency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {forecastData.items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        {item.sku && <div className="text-xs text-gray-500">SKU: {item.sku}</div>}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm text-gray-900">{item.stockQuantity}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm text-gray-900">{item.avgDailyUsage.toFixed(1)}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-medium text-orange-600">{item.daysUntilStockout} days</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm text-gray-900">
                          {new Date(item.estimatedStockoutDate).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            item.urgency === "critical"
                              ? "bg-red-100 text-red-700"
                              : item.urgency === "high"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {item.urgency.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
