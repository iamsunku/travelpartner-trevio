import { Request, Response, NextFunction } from "express";
import { db as prisma } from "../lib/db.js";

export function analyticsMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    const originalSend = res.send;
    res.send = function (data: any) {
      const responseTime = Date.now() - startTime;
      const heapUsed = process.memoryUsage().heapUsed - startMemory;

      // Capture status code
      const statusCode = res.statusCode;

      // Extract userId from request if available
      const userId = (req as any).userId;
      const agencyId = (req as any).agencyId;

      // Only track non-health check endpoints
      if (req.path !== "/api/health" && !req.path.includes("/metrics")) {
        // Store metrics asynchronously (don't block response)
        storeApiMetric({
          endpoint: req.path,
          method: req.method,
          statusCode,
          responseTime,
          userId: userId || null,
          agencyId: agencyId || null,
          errorMessage: statusCode >= 400 ? data?.message || null : null,
        }).catch((err) => {
          console.error("[analytics] Failed to store metric:", err);
        });
      }

      // Call original send
      return originalSend.call(this, data);
    };

    next();
  };
}

async function storeApiMetric(metric: {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  userId: string | null;
  agencyId: string | null;
  errorMessage: string | null;
}) {
  try {
    await prisma.apiMetric.create({
      data: {
        endpoint: metric.endpoint,
        method: metric.method,
        statusCode: metric.statusCode,
        responseTime: metric.responseTime,
        userId: metric.userId,
        agencyId: metric.agencyId,
        errorMessage: metric.errorMessage,
      },
    });
  } catch (error) {
    console.error("[analytics] Failed to create metric:", error);
  }
}

// Aggregate metrics into PerformanceMetric (run periodically)
export async function aggregateMetrics() {
  try {
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const hour = now.getHours();

    // Get metrics from last hour
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const metrics = await prisma.apiMetric.findMany({
      where: {
        createdAt: {
          gte: oneHourAgo,
          lte: now,
        },
      },
    });

    if (metrics.length === 0) return;

    // Calculate aggregates
    const totalRequests = metrics.length;
    const errorCount = metrics.filter((m) => m.statusCode >= 400).length;
    const avgResponseTime =
      metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests;

    // Store aggregated metrics
    await Promise.all([
      prisma.performanceMetric.upsert({
        where: { metric_date_hour: { metric: "request_count", date: dateStr, hour } },
        create: {
          metric: "request_count",
          value: totalRequests,
          unit: "count",
          date: dateStr,
          hour,
        },
        update: { value: totalRequests },
      }),
      prisma.performanceMetric.upsert({
        where: { metric_date_hour: { metric: "error_count", date: dateStr, hour } },
        create: {
          metric: "error_count",
          value: errorCount,
          unit: "count",
          date: dateStr,
          hour,
        },
        update: { value: errorCount },
      }),
      prisma.performanceMetric.upsert({
        where: { metric_date_hour: { metric: "avg_response_time", date: dateStr, hour } },
        create: {
          metric: "avg_response_time",
          value: avgResponseTime,
          unit: "ms",
          date: dateStr,
          hour,
        },
        update: { value: avgResponseTime },
      }),
    ]);

    console.log(`[analytics] Aggregated ${totalRequests} metrics for ${dateStr} hour ${hour}`);
  } catch (error) {
    console.error("[analytics] Failed to aggregate metrics:", error);
  }
}
