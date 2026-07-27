"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle, Clock, Hotel, Plane, Car } from "lucide-react";
import { PageShell, PageHeader, MetricCard } from "@/components/shared/ui-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { formatActivityPrice, formatHotelFromPrice, formatTransferPrice } from "@/lib/currency";

interface PendingProduct {
  id: string;
  name: string;
  location?: string;
  city?: string;
  type: "activity" | "transfer" | "hotel";
  adultPrice?: number;
  childPrice?: number;
  privatePrice?: number;
  sharedAdultPrice?: number;
  sharedPrice?: number;
  roomCategories?: unknown[];
  currency: string;
  approvalStatus: string;
  pendingRateChanges?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string;
}

function livePrice(item: PendingProduct): string {
  if (item.type === "activity") {
    return formatActivityPrice(item);
  }
  if (item.type === "transfer") {
    return formatTransferPrice(item);
  }
  return formatHotelFromPrice(item);
}

function pendingPrice(item: PendingProduct): string | null {
  const pending = item.pendingRateChanges;
  if (!pending || typeof pending !== "object" || Object.keys(pending).length === 0) return null;
  const merged = { ...item, ...pending };
  return livePrice(merged as PendingProduct);
}

export function ProductApprovalsView() {
  const { toast } = useToast();
  const [items, setItems] = useState<PendingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [rejectingItem, setRejectingItem] = useState<PendingProduct | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [activities, transfers, hotels] = await Promise.all([
        apiFetch<{ items: PendingProduct[] }>("/api/products/activities?approvalStatus=Pending&pageSize=100"),
        apiFetch<{ items: PendingProduct[] }>("/api/products/transfers?approvalStatus=Pending&pageSize=100"),
        apiFetch<{ items: PendingProduct[] }>("/api/products/hotels?approvalStatus=Pending&pageSize=100"),
      ]);

      const allItems = [
        ...activities.items.map((i) => ({ ...i, type: "activity" as const })),
        ...transfers.items.map((i) => ({ ...i, type: "transfer" as const })),
        ...hotels.items.map((i) => ({ ...i, type: "hotel" as const })),
      ].filter((i) => filterType === "all" || i.type === filterType);

      setItems(allItems.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    } catch {
      toast({ title: "Failed to load pending approvals", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filterType, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (item: PendingProduct) => {
    try {
      const apiPath = `/api/products/${item.type === "hotel" ? "hotels" : `${item.type}s`}/${item.id}/approve`;
      await apiFetch(apiPath, { method: "POST" });
      toast({ title: "Rates approved and live", description: `${item.name} is now available for agents to book.` });
      load();
    } catch {
      toast({ title: "Approval failed", variant: "destructive" });
    }
  };

  const handleReject = async (item: PendingProduct) => {
    if (!rejectionReason.trim()) {
      toast({ title: "Please provide a rejection reason", variant: "destructive" });
      return;
    }
    try {
      const apiPath = `/api/products/${item.type === "hotel" ? "hotels" : `${item.type}s`}/${item.id}/reject`;
      await apiFetch(apiPath, { method: "POST", body: JSON.stringify({ reason: rejectionReason }) });
      toast({ title: "Rates rejected", description: item.name, variant: "destructive" });
      setRejectingItem(null);
      setRejectionReason("");
      load();
    } catch {
      toast({ title: "Rejection failed", variant: "destructive" });
    }
  };

  const typeLabel = (type: string) => {
    const labels: Record<string, string> = {
      activity: "Activity",
      transfer: "Transfer",
      hotel: "Hotel",
    };
    return labels[type] || type;
  };

  return (
    <PageShell>
      <PageHeader
        title="Product Rate Approvals"
        subtitle="Audit all rate uploads and updates before they go live — prevents pricing errors from reaching agents"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard icon={Clock} label="Pending" value={String(items.length)} color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" index={0} />
        <MetricCard icon={Plane} label="Activities" value={String(items.filter((i) => i.type === "activity").length)} color="bg-sky-100 text-primary dark:bg-sky-500/15 dark:text-sky-400" index={1} />
        <MetricCard icon={Car} label="Transfers" value={String(items.filter((i) => i.type === "transfer").length)} color="bg-teal-100 text-brand-teal dark:bg-teal-500/15 dark:text-teal-400" index={2} />
        <MetricCard icon={Hotel} label="Hotels" value={String(items.filter((i) => i.type === "hotel").length)} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" index={3} />
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="activity">Activities</SelectItem>
                <SelectItem value="transfer">Transfers</SelectItem>
                <SelectItem value="hotel">Hotels</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {items.length} pending {items.length === 1 ? "approval" : "approvals"}
            </p>
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Current Live Rate</TableHead>
                  <TableHead>Proposed Rate</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No pending rate approvals
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => {
                    const proposed = pendingPrice(item);
                    const isRateUpdate = !!proposed;
                    return (
                      <TableRow key={item.id} className="hover:bg-muted/50">
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{typeLabel(item.type)}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-muted-foreground">{item.location || item.city || "—"}</TableCell>
                        <TableCell>
                          {isRateUpdate ? (
                            <span className="text-muted-foreground line-through">{livePrice(item)}</span>
                          ) : (
                            <span>—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold text-primary">
                          {proposed || livePrice(item)}
                          {!isRateUpdate && (
                            <span className="block text-[10px] font-normal text-muted-foreground">New product</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(item.updatedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => handleApprove(item)}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => setRejectingItem(item)}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!rejectingItem} onOpenChange={(open) => { if (!open) setRejectingItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Product Rates</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="font-medium">{rejectingItem?.name}</p>
              <p className="text-sm text-muted-foreground">
                Explain why these rates are incorrect (e.g. missing zero, wrong currency). Live rates stay unchanged if this is a rate update.
              </p>
            </div>
            <Textarea
              placeholder="Reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectingItem && handleReject(rejectingItem)}>
              <XCircle className="w-4 h-4 mr-1" />
              Reject Rates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
