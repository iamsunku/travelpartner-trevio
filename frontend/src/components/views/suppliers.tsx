"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Search, Pencil, Trash2, MapPin, Phone, Mail, FileText, Landmark,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/app-store";
import { api, ApiError } from "@/lib/api";
import type { SupplierRecord } from "@/types";
import { SUPPLIER_TYPES } from "@/lib/supplier-taxonomy";
import { hasCrudPermission } from "@/lib/permissions";
import { PageHeader, PageShell, StatusBadge } from "@/components/shared/ui-helpers";

const PHONE_CODES = ["+91", "+971", "+65", "+1", "+44", "+61", "+66", "+94", "+977"];

const EMPTY_FORM = {
  name: "",
  country: "",
  city: "",
  type: "DMC",
  contactPerson: "",
  email: "",
  phoneCountryCode: "+91",
  phone: "",
  status: "Active",
  documentUrl: "",
  documentName: "",
  bankName: "",
  accountHolder: "",
  accountNumber: "",
  ifscCode: "",
  swiftCode: "",
  bankCountry: "",
  notes: "",
};

type FormState = typeof EMPTY_FORM;

export function SuppliersView() {
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const canAdd = user && hasCrudPermission(user, "suppliers", "add");
  const canEdit = user && hasCrudPermission(user, "suppliers", "edit");
  const canDelete = user && hasCrudPermission(user, "suppliers", "delete");

  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierRecord | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (typeFilter !== "All") params.type = typeFilter;
      if (search.trim()) params.q = search.trim();
      const res = await api.getSuppliers(params);
      setSuppliers(res.suppliers || []);
    } catch {
      setSuppliers([]);
      toast({ title: "Could not load suppliers", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, toast]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const countries = useMemo(
    () => [...new Set(suppliers.map((s) => s.country).filter(Boolean))].sort() as string[],
    [suppliers],
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(s: SupplierRecord) {
    setEditing(s);
    setForm({
      name: s.name,
      country: s.country || "",
      city: s.city || "",
      type: s.type,
      contactPerson: s.contactPerson || "",
      email: s.email || "",
      phoneCountryCode: s.phoneCountryCode || "+91",
      phone: s.phone || "",
      status: s.status,
      documentUrl: s.documentUrl || "",
      documentName: s.documentName || "",
      bankName: s.bankName || "",
      accountHolder: s.accountHolder || "",
      accountNumber: s.accountNumber || "",
      ifscCode: s.ifscCode || "",
      swiftCode: s.swiftCode || "",
      bankCountry: s.bankCountry || "",
      notes: s.notes || "",
    });
    setDialogOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        documentUrl: form.documentUrl || undefined,
        documentName: form.documentName || undefined,
      };
      if (editing) {
        await api.updateSupplier(editing.id, payload);
        toast({ title: "Supplier updated" });
      } else {
        await api.createSupplier(payload);
        toast({ title: "Supplier registered" });
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof ApiError ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove(s: SupplierRecord) {
    if (!confirm(`Remove ${s.name}?`)) return;
    try {
      const res = await api.deleteSupplier(s.id);
      toast({ title: res.deactivated ? "Supplier deactivated" : "Supplier removed", description: res.message });
      await load();
    } catch (e) {
      toast({ title: "Delete failed", description: e instanceof ApiError ? e.message : "Error", variant: "destructive" });
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Supplier Management"
        subtitle="Register DMCs, hotels, transfers, and vendors — used when confirming bookings and payouts"
        action={
          canAdd ? (
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> Register supplier
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 h-9"
                placeholder="Search name, city, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All types</SelectItem>
                {SUPPLIER_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : suppliers.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No suppliers yet. Register your first vendor.</TableCell></TableRow>
                ) : (
                  suppliers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <p className="font-medium text-sm">{s.name}</p>
                        {s.contactPerson && <p className="text-xs text-muted-foreground">{s.contactPerson}</p>}
                      </TableCell>
                      <TableCell><Badge variant="secondary">{s.type}</Badge></TableCell>
                      <TableCell className="text-xs">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.city}, {s.country}</span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {s.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{s.email}</span>}
                        {s.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.phoneCountryCode} {s.phone}</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.bankName ? (
                          <span className="flex items-center gap-1"><Landmark className="w-3 h-3" />{s.bankName}</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                      <TableCell className="text-right">
                        {canEdit && (
                          <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(s)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {countries.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {suppliers.length} supplier(s) across {countries.length} countries
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit supplier" : "Register supplier"}</DialogTitle>
            <DialogDescription>
              Country → city → type → contact. Document upload is optional. Only ops and admins can register.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="profile">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="document">Document</TabsTrigger>
              <TabsTrigger value="bank">Bank</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="grid gap-3 sm:grid-cols-2 pt-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Supplier name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Country *</Label>
                <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="India" />
              </div>
              <div className="space-y-1.5">
                <Label>City *</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Goa" />
              </div>
              <div className="space-y-1.5">
                <Label>Supplier type *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Contact person</Label>
                <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone country code</Label>
                <Select value={form.phoneCountryCode} onValueChange={(v) => setForm({ ...form, phoneCountryCode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PHONE_CODES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Phone number</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </TabsContent>

            <TabsContent value="document" className="space-y-3 pt-3">
              <p className="text-xs text-muted-foreground">Optional — contract, KYC, or agreement link.</p>
              <div className="space-y-1.5">
                <Label>Document name</Label>
                <Input value={form.documentName} onChange={(e) => setForm({ ...form, documentName: e.target.value })} placeholder="Supplier agreement 2026" />
              </div>
              <div className="space-y-1.5">
                <Label>Document URL</Label>
                <Input value={form.documentUrl} onChange={(e) => setForm({ ...form, documentUrl: e.target.value })} placeholder="https://…" />
              </div>
              {form.documentUrl && (
                <a href={form.documentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> Preview document
                </a>
              )}
            </TabsContent>

            <TabsContent value="bank" className="grid gap-3 sm:grid-cols-2 pt-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Bank name</Label>
                <Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Account holder</Label>
                <Input value={form.accountHolder} onChange={(e) => setForm({ ...form, accountHolder: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Account number</Label>
                <Input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>IFSC (India)</Label>
                <Input value={form.ifscCode} onChange={(e) => setForm({ ...form, ifscCode: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>SWIFT (international)</Label>
                <Input value={form.swiftCode} onChange={(e) => setForm({ ...form, swiftCode: e.target.value })} />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Bank country</Label>
                <Input value={form.bankCountry} onChange={(e) => setForm({ ...form, bankCountry: e.target.value })} />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Notes</Label>
                <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700" disabled={saving} onClick={save}>
              {editing ? "Save changes" : "Register"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
