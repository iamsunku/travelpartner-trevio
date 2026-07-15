import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Summary {
  totalRequests: number;
  errorCount: number;
  errorRate: number;
  avgResponseTime: number;
  uptime: number;
  statusCodeDistribution: Record<number, number>;
  timeRange: string;
}

interface Endpoint {
  endpoint: string;
  method: string;
  count: number;
  avgResponseTime: number;
  errorCount: number;
  errorRate: number;
}

interface ApiError {
  id: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  errorMessage: string;
  createdAt: string;
}

interface UserActivity {
  userId: string;
  requestCount: number;
  avgResponseTime: number;
  errorCount: number;
}

export function AnalyticsDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [errors, setErrors] = useState<ApiError[]>([]);
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [hours]);

  async function fetchAnalytics() {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [summaryRes, endpointsRes, errorsRes, activityRes] =
        await Promise.all([
          fetch("/api/analytics/summary", { headers }),
          fetch(`/api/analytics/endpoints?hours=${hours}`, { headers }),
          fetch(`/api/analytics/errors?hours=${hours}`, { headers }),
          fetch(`/api/analytics/user-activity?hours=${hours}`, { headers }),
        ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (endpointsRes.ok) setEndpoints((await endpointsRes.json()).stats || []);
      if (errorsRes.ok) setErrors((await errorsRes.json()).errors || []);
      if (activityRes.ok)
        setUserActivity((await activityRes.json()).activity || []);

      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
      setLoading(false);
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    );

  if (!summary)
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">No analytics data available</div>
      </div>
    );

  const statusChartData = Object.entries(summary.statusCodeDistribution).map(
    ([code, count]) => ({
      name: `${code}`,
      value: count,
    })
  );

  const endpointChartData = endpoints
    .slice(0, 10)
    .map((e) => ({
      name: `${e.method} ${e.endpoint.substring(0, 30)}`,
      requests: e.count,
      avgTime: e.avgResponseTime,
    }));

  const userActivityData = userActivity
    .slice(0, 5)
    .map((u) => ({
      name: u.userId.substring(0, 8),
      requests: u.requestCount,
      avgTime: u.avgResponseTime,
    }));

  const COLORS = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Performance Analytics</h1>
        <div className="flex gap-2">
          {[24, 7, 30].map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={`px-4 py-2 rounded ${
                hours === h
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {h}h
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-gray-600 text-sm font-medium">Total Requests</div>
          <div className="text-3xl font-bold mt-2">{summary.totalRequests}</div>
          <div className="text-green-600 text-xs mt-1">
            {summary.uptime}% uptime
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-gray-600 text-sm font-medium">Errors</div>
          <div className="text-3xl font-bold mt-2 text-red-600">
            {summary.errorCount}
          </div>
          <div className="text-red-600 text-xs mt-1">
            {summary.errorRate}% error rate
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-gray-600 text-sm font-medium">
            Avg Response Time
          </div>
          <div className="text-3xl font-bold mt-2">
            {summary.avgResponseTime}ms
          </div>
          <div className="text-blue-600 text-xs mt-1">
            {summary.avgResponseTime < 200 ? "Excellent" : "Good"}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-gray-600 text-sm font-medium">Status 200</div>
          <div className="text-3xl font-bold mt-2 text-green-600">
            {summary.statusCodeDistribution[200] || 0}
          </div>
          <div className="text-green-600 text-xs mt-1">Successful</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-gray-600 text-sm font-medium">Status 4xx/5xx</div>
          <div className="text-3xl font-bold mt-2 text-red-600">
            {(summary.statusCodeDistribution[400] || 0) +
              (summary.statusCodeDistribution[500] || 0)}
          </div>
          <div className="text-red-600 text-xs mt-1">Client & Server</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Code Distribution */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Status Code Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusChartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Endpoints */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Top Endpoints</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={endpointChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="requests" fill="#3b82f6" name="Requests" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Response Time Trend */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Endpoint Response Times</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={endpointChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="avgTime"
              stroke="#f59e0b"
              name="Avg Response Time (ms)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* User Activity */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Top Active Users</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={userActivityData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="requests" fill="#10b981" name="Requests" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Endpoint Details Table */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Endpoint Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">
                  Endpoint
                </th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">
                  Method
                </th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700">
                  Requests
                </th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700">
                  Avg Time
                </th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700">
                  Error Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {endpoints.slice(0, 15).map((ep, idx) => (
                <tr
                  key={idx}
                  className="border-t hover:bg-gray-50"
                >
                  <td className="px-4 py-2 text-sm text-gray-700">
                    {ep.endpoint}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                      {ep.method}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-right text-gray-700">
                    {ep.count}
                  </td>
                  <td className="px-4 py-2 text-sm text-right text-gray-700">
                    {ep.avgResponseTime}ms
                  </td>
                  <td className="px-4 py-2 text-sm text-right">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        ep.errorRate > 10
                          ? "bg-red-100 text-red-700"
                          : ep.errorRate > 0
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-green-100 text-green-700"
                      }`}
                    >
                      {ep.errorRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Errors */}
      {errors.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Recent Errors</h2>
          <div className="space-y-2">
            {errors.slice(0, 10).map((err) => (
              <div
                key={err.id}
                className="p-3 bg-red-50 border border-red-200 rounded"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-red-700">
                      {err.method} {err.endpoint}
                    </div>
                    <div className="text-sm text-red-600">
                      {err.statusCode} - {err.errorMessage}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(err.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
