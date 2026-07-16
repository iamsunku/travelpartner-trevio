"use client";

import { useMemo, useState } from "react";
import {
  Users, Building2, User, Crown, Plus, Search, Phone, Mail, MapPin,
  Calendar, Award, BookOpen, FileText, StickyNote, Activity, Plane,
  Star,
} from "lucide-react";
import { useDemoDataStore } from "@/store/demo-data-store";
import type { Customer } from "@/types";
import {
  formatINR, formatFullINR, StatusBadge, PageHeader, PageShell, MetricCard, initials, avatarGradient,
} from "@/components/shared/ui-helpers";
import {
  Card, CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const SERVICE_ICONS: Record<string, React.ElementType> = {
  Flight: Plane, Hotel: Building2, Holiday: Star,
};

const TRAVEL_HISTORY: Record<string, { route: string; date: string; service: string; amount: number }[]> = {
  "cu-1": [
    { route: "MUM → DEL → MUM", date: "2025-01-12", service: "Flight", amount: 28400 },
    { route: "Goa Beach Party - 3N", date: "2024-12-22", service: "Holiday", amount: 14999 },
    { route: "Taj Palace Delhi - 2N", date: "2024-11-08", service: "Hotel", amount: 24500 },
  ],
  "cu-2": [
    { route: "BLR → DXB → BLR", date: "2025-01-19", service: "Flight", amount: 124000 },
    { route: "Bali Bliss - 6N", date: "2024-12-10", service: "Holiday", amount: 99998 },
  ],
  "cu-6": [
    { route: "BLR → SIN → BLR (Group 8)", date: "2025-01-15", service: "Flight", amount: 320000 },
    { route: "Marina Bay Sands - 4N", date: "2025-01-15", service: "Hotel", amount: 184000 },
    { route: "Q3 Offsite - Goa", date: "2024-10-08", service: "Holiday", amount: 480000 },
  ],
};

const ACTIVITY_TIMELINE: Record<string, { time: string; title: string; type: string }[]> = {
  "cu-1": [
    { time: "2 days ago", title: "Booking BK-8841 confirmed (MUM-DEL)", type: "booking" },
    { time: "1 week ago", title: "Loyalty points credited: 284", type: "loyalty" },
    { time: "3 weeks ago", title: "Completed Goa Holiday Package", type: "booking" },
    { time: "1 month ago", title: "Profile updated - new passport", type: "profile" },
    { time: "2 months ago", title: "Upgraded to Platinum tier", type: "tier" },
  ],
  "cu-2": [
    { time: "1 day ago", title: "Corporate booking BK-8844 ticketed (BLR-DXB)", type: "booking" },
    { time: "5 days ago", title: "New contract signed - Annual travel", type: "contract" },
    { time: "2 weeks ago", title: "Bali holiday package completed", type: "booking" },
    { time: "1 month ago", title: "Invoice INV-2024-4589 paid", type: "payment" },
  ],
  "cu-6": [
    { time: "1 day ago", title: "Group booking to Singapore (8 pax)", type: "booking" },
    { time: "1 week ago", title: "Marina Bay Sands hotel confirmed", type: "booking" },
    { time: "3 months ago", title: "Q3 offsite invoice paid", type: "payment" },
    { time: "6 months ago", title: "Quarterly contract renewed", type: "contract" },
  ],
};

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  booking: Plane, loyalty: Award, profile: User, tier: Crown,
  contract: FileText, payment: FileText,
};

function AddCustomerDialog() {
  const { toast } = useToast();
  const addCustomer = useDemoDataStore((s) => s.addCustomer);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", type: "Individual", city: "" });

  function submit() {
    if (!form.name || !form.email) {
      toast({ title: "Missing fields", description: "Name and email are required", variant: "destructive" });
      return;
    }
    addCustomer({
      name: form.name,
      email: form.email,
      phone: form.phone,
      type: form.type as Customer["type"],
      city: form.city,
      tier: "Silver",
    });
    toast({ title: "Customer added", description: `${form.name} added as ${form.type} customer` });
    setOpen(false);
    setForm({ name: "", email: "", phone: "", type: "Individual", city: "" });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-1" /> Add Customer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Customer</DialogTitle>
          <DialogDescription>Create a new customer profile in your CRM.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="c-name">Full Name / Company</Label>
            <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Karthik Venkat" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
            </div>
            <div>
              <Label htmlFor="c-phone">Phone</Label>
              <Input id="c-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98000 00000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Individual">Individual</SelectItem>
                  <SelectItem value="Corporate">Corporate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="c-city">City</Label>
              <Input id="c-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Mumbai" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-primary hover:bg-primary/90">Add Customer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProfileSheet({ customer, open, onOpenChange }: { customer: Customer | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  if (!customer) return null;
  const history = TRAVEL_HISTORY[customer.id] || [
    { route: customer.lastBooking ? "Recent booking" : "—", date: customer.lastBooking || "—", service: "Flight", amount: customer.totalSpent / customer.totalBookings },
  ];
  const timeline = ACTIVITY_TIMELINE[customer.id] || [
    { time: "1 month ago", title: "Joined as customer", type: "profile" },
  ];
  const nextTierPts = customer.tier === "Silver" ? 1000 : customer.tier === "Gold" ? 3000 : 5000;
  const tierProgress = Math.min((customer.loyaltyPoints / nextTierPts) * 100, 100);

  const documents = [
    { name: "PAN Card", type: "Identity", verified: true },
    { name: "Aadhaar Card", type: "Identity", verified: true },
    ...(customer.passportNo ? [{ name: `Passport (${customer.passportNo})`, type: "Travel", verified: true }] : []),
    { name: "Address Proof", type: "Address", verified: false },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto scroll-thin">
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center gap-3">
            <Avatar className="w-14 h-14">
              <AvatarFallback className={cn("text-lg font-bold text-white bg-gradient-to-br", avatarGradient(customer.name))}>
                {initials(customer.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle className="text-lg">{customer.name}</SheetTitle>
              <SheetDescription className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {customer.email}</span>
                <span>·</span>
                <StatusBadge status={customer.tier} />
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="grid grid-cols-3 gap-2 p-4 border-b">
          <div className="text-center">
            <p className="text-base font-bold">{customer.totalBookings}</p>
            <p className="text-[10px] text-muted-foreground">Bookings</p>
          </div>
          <div className="text-center border-x">
            <p className="text-base font-bold">{formatINR(customer.totalSpent)}</p>
            <p className="text-[10px] text-muted-foreground">Total Spent</p>
          </div>
          <div className="text-center">
            <p className="text-base font-bold">{customer.loyaltyPoints.toLocaleString("en-IN")}</p>
            <p className="text-[10px] text-muted-foreground">Loyalty Pts</p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="px-4 pb-4">
          <TabsList className="grid grid-cols-4 w-full bg-muted/60 h-9 text-[11px]">
            <TabsTrigger value="overview">Profile</TabsTrigger>
            <TabsTrigger value="history">Travel</TabsTrigger>
            <TabsTrigger value="documents">Docs</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3 mt-3">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact Information</p>
              <div className="grid grid-cols-1 gap-1.5 text-xs">
                <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-muted-foreground" /> {customer.phone}</div>
                <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-muted-foreground" /> {customer.email}</div>
                <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-muted-foreground" /> {customer.city}</div>
                <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-muted-foreground" /> Member since {new Date(customer.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</div>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Loyalty & Tier</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Current Tier</span>
                <StatusBadge status={customer.tier} />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Progress to next tier</span>
                  <span className="font-medium">{customer.loyaltyPoints.toLocaleString("en-IN")} / {nextTierPts.toLocaleString("en-IN")}</span>
                </div>
                <Progress value={tierProgress} className="h-2" />
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Travel Documents</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border p-2">
                  <p className="text-muted-foreground">Passport No</p>
                  <p className="font-medium">{customer.passportNo || "—"}</p>
                </div>
                <div className="rounded-lg border p-2">
                  <p className="text-muted-foreground">Visa Status</p>
                  {customer.visaStatus ? <StatusBadge status={customer.visaStatus} /> : <span className="text-muted-foreground">—</span>}
                </div>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><StickyNote className="w-3 h-3" /> Notes</p>
                <Button variant="ghost" size="sm" className="h-6 text-[11px] text-teal-600" onClick={() => toast({ title: "Notes saved", description: "Customer notes updated successfully" })}>Save</Button>
              </div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about preferences, special requests, etc..."
                className="text-xs min-h-[80px]"
              />
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-2 mt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><BookOpen className="w-3 h-3" /> Travel History</p>
            {history.map((h, i) => {
              const Icon = SERVICE_ICONS[h.service] || Plane;
              return (
                <div key={i} className="flex items-center gap-3 rounded-lg border p-2.5 hover:bg-muted/40 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{h.route}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(h.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · {h.service}</p>
                  </div>
                  <span className="text-xs font-semibold">{formatINR(h.amount)}</span>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="documents" className="space-y-2 mt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><FileText className="w-3 h-3" /> Documents</p>
            {documents.map((d, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border p-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{d.name}</p>
                  <p className="text-[10px] text-muted-foreground">{d.type}</p>
                </div>
                {d.verified ? (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 text-[10px]">Verified</Badge>
                ) : (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 text-[10px]">Pending</Badge>
                )}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="activity" className="space-y-3 mt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Activity className="w-3 h-3" /> Activity Timeline</p>
            <div className="relative pl-4">
              <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
              {timeline.map((t, i) => {
                const Icon = ACTIVITY_ICONS[t.type] || Activity;
                return (
                  <div key={i} className="relative pb-3">
                    <div className="absolute -left-[10px] w-3.5 h-3.5 rounded-full bg-teal-500 ring-2 ring-background flex items-center justify-center">
                      <Icon className="w-2 h-2 text-white" />
                    </div>
                    <div className="ml-3">
                      <p className="text-xs font-medium">{t.title}</p>
                      <p className="text-[10px] text-muted-foreground">{t.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

export function CustomersView() {
  const customers = useDemoDataStore((s) => s.customers);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (tierFilter !== "all" && c.tier !== tierFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.email.toLowerCase().includes(q) && !c.city.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [search, typeFilter, tierFilter, customers]);

  const stats = [
    { icon: Users, label: "Total Customers", value: String(customers.length), color: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400" },
    { icon: Building2, label: "Corporate", value: String(customers.filter((c) => c.type === "Corporate").length), color: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400" },
    { icon: User, label: "Individual", value: String(customers.filter((c) => c.type === "Individual").length), color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400" },
    { icon: Crown, label: "Platinum Members", value: String(customers.filter((c) => c.tier === "Platinum").length), color: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" },
  ];

  function openCustomer(c: Customer) {
    setSelected(c);
    setSheetOpen(true);
  }

  return (
    <PageShell>
      <PageHeader
        title="Customers"
        subtitle="Manage your customer relationships, profiles, and loyalty programs."
        action={<AddCustomerDialog />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, i) => <MetricCard key={s.label} {...s} index={i} />)}
      </div>

      <Card className="border-border/80 shadow-none">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between mb-3">
            <div className="flex flex-1 gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, city..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Individual">Individual</SelectItem>
                  <SelectItem value="Corporate">Corporate</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Tier" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="Silver">Silver</SelectItem>
                  <SelectItem value="Gold">Gold</SelectItem>
                  <SelectItem value="Platinum">Platinum</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-border/80 max-h-[60vh] overflow-y-auto scroll-thin">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-center">Bookings</TableHead>
                  <TableHead className="text-right">Total Spent</TableHead>
                  <TableHead className="text-right">Loyalty</TableHead>
                  <TableHead>Last Booking</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openCustomer(c)}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className={cn("text-[10px] font-semibold text-white bg-gradient-to-br", avatarGradient(c.name))}>
                            {initials(c.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{c.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn("text-[10px]", c.type === "Corporate" ? "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400" : "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400")}>
                        {c.type === "Corporate" ? <Building2 className="w-3 h-3 mr-1" /> : <User className="w-3 h-3 mr-1" />}
                        {c.type}
                      </Badge>
                    </TableCell>
                    <TableCell><StatusBadge status={c.tier} /></TableCell>
                    <TableCell className="text-center text-sm font-medium">{c.totalBookings}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">{formatFullINR(c.totalSpent)}</TableCell>
                    <TableCell className="text-right text-xs">{c.loyaltyPoints.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.lastBooking ? new Date(c.lastBooking).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 text-teal-600 hover:text-teal-700" onClick={(e) => { e.stopPropagation(); openCustomer(c); }}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">No customers found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Showing {filtered.length} of {customers.length} customers · Click a row to view full profile</p>
        </CardContent>
      </Card>

      <ProfileSheet customer={selected} open={sheetOpen} onOpenChange={setSheetOpen} />
    </PageShell>
  );
}
