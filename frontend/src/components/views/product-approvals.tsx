"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/shared/ui-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

interface PendingProduct {
  id: string;
  name: string;
  location?: string;
  type: "activity" | "transfer" | "hotel";
  adultPrice?: number;
  privatePrice?: number;
  currency: string;
  approvalStatus: string;
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string;
}

export function ProductApprovalsView() {
  const { toast } = useToast();
  const [items, setItems] = useState<PendingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("Pending");
  const [selectedItem, setSelectedItem] = useState<PendingProduct | null>(null);
  const [rejectingItem, setRejectingItem] = useState<PendingProduct | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Load pending approvals from all product types
      const [activities, transfers, hotels] = await Promise.all([
        apiFetch<{ items: PendingProduct[] }>("/api/products/activities?status=Pending"),
        apiFetch<{ items: PendingProduct[] }>("/api/products/transfers?status=Pending"),
        apiFetch<{ items: PendingProduct[] }>("/api/products/hotels?status=Pending"),
      ]);

      const allItems = [
        ...activities.items.map((i) => ({ ...i, type: "activity" as const })),
        ...transfers.items.map((i) => ({ ...i, type: "transfer" as const })),
        ...hotels.items.map((i) => ({ ...i, type: "hotel" as const })),
      ].filter((i) => filterType === "all" || i.type === filterType);

      setItems(allItems.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    } catch (e) {
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
      const apiPath = `/api/products/${item.type}s/${item.id}/approve`;
      await apiFetch(apiPath, { method: "POST" });
      toast({ title: "Product approved and activated", description: item.name });
      load();
    } catch (e) {
      toast({ title: "Approval failed", variant: "destructive" });
    }
  };

  const handleReject = async (item: PendingProduct) => {
    if (!rejectionReason.trim()) {
      toast({ title: "Please provide a rejection reason", variant: "destructive" });
      return;
    }
    try {
      const apiPath = `/api/products/${item.type}s/${item.id}/reject`;
      await apiFetch(apiPath, { method: "POST", body: JSON.stringify({ reason: rejectionReason }) });
      toast({ title: "Product rejected", description: item.name, variant: "destructive" });
      setRejectingItem(null);
      setRejectionReason("");
      load();
    } catch (e) {
      toast({ title: "Rejection failed", variant: "destructive" });
    }
  };

  const priceDisplay = (item: PendingProduct) => {
    if (item.type === "activity") {
      return `₹${(item.adultPrice ?? 0).toLocaleString("en-IN")}`;
    }
    if (item.type === "transfer") {
      return `₹${(item.privatePrice ?? 0).toLocaleString("en-IN")}`;
    }
    return "—";
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
    <div className="space-y-6">
      <PageHeader
        title="Product Rate Approvals"
        subtitle="Review and approve/reject product rates before they go live"
      />

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
            <div className="flex gap-2">
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
            </div>
            <div className="text-sm text-muted-foreground">
              {items.length} pending {items.length === 1 ? "approval" : "approvals"}
            </div>
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Currency</TableHead>
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
                      No pending approvals
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <span className="px-2 py-1 rounded-md bg-blue-100 text-blue-700 text-xs">
                          {typeLabel(item.type)}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.location || "—"}</TableCell>
                      <TableCell>{priceDisplay(item)}</TableCell>
                      <TableCell>{item.currency}</TableCell>
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      <Dialog open={!!rejectingItem} onOpenChange={(open) => { if (!open) setRejectingItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Product Rate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="font-medium">{rejectingItem?.name}</p>
              <p className="text-sm text-muted-foreground">Please explain why this rate is being rejected</p>
            </div>
            <Textarea
              placeholder="Reason for rejection (e.g., Price seems too low, Missing required information, etc.)"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingItem(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectingItem && handleReject(rejectingItem)}
            >
              <XCircle className="w-4 h-4 mr-1" />
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
