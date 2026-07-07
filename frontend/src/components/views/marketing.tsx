"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Plus, Mail, MessageCircle, Send, MoreHorizontal, Pencil, Trash2, Copy,
  Ticket, Tag, Calendar, Eye, MousePointerClick, Play, Pause, Image as ImageIcon,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, StatusBadge } from "@/components/shared/ui-helpers";
import { cn } from "@/lib/utils";

type CampaignType = "Email" | "WhatsApp" | "SMS";
type CampaignStatus = "Draft" | "Scheduled" | "Running" | "Completed";

interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  audience: number;
  sent: number;
  opened: number;
  clicked: number;
  status: CampaignStatus;
  date: string;
  gradient: string;
}

const CAMPAIGNS: Campaign[] = [
  { id: "cm-1", name: "Republic Day Flight Sale", type: "Email", audience: 12840, sent: 12840, opened: 5240, clicked: 1420, status: "Completed", date: "2025-01-20", gradient: "from-teal-500 to-emerald-600" },
  { id: "cm-2", name: "Bali Honeymoon Package — WhatsApp Blast", type: "WhatsApp", audience: 3420, sent: 3380, opened: 2910, clicked: 824, status: "Running", date: "2025-01-19", gradient: "from-emerald-500 to-teal-600" },
  { id: "cm-3", name: "Weekend Goa Getaway Reminder", type: "SMS", audience: 8240, sent: 8240, opened: 6120, clicked: 980, status: "Completed", date: "2025-01-18", gradient: "from-amber-500 to-orange-600" },
  { id: "cm-4", name: "Summer Europe Early Bird", type: "Email", audience: 5420, sent: 0, opened: 0, clicked: 0, status: "Scheduled", date: "2025-02-01", gradient: "from-violet-500 to-purple-600" },
  { id: "cm-5", name: "Visa Renewal Reminder", type: "WhatsApp", audience: 1240, sent: 0, opened: 0, clicked: 0, status: "Draft", date: "—", gradient: "from-cyan-500 to-teal-600" },
  { id: "cm-6", name: "Holiday Package — Christmas Special", type: "Email", audience: 18420, sent: 18420, opened: 8120, clicked: 2240, status: "Completed", date: "2024-12-15", gradient: "from-rose-500 to-pink-600" },
];

const CAMPAIGN_PERF = [
  { day: "Mon", opens: 1240, clicks: 320 },
  { day: "Tue", opens: 2180, clicks: 580 },
  { day: "Wed", opens: 3120, clicks: 820 },
  { day: "Thu", opens: 4280, clicks: 1140 },
  { day: "Fri", opens: 5240, clicks: 1420 },
  { day: "Sat", opens: 4180, clicks: 980 },
  { day: "Sun", opens: 3420, clicks: 760 },
];

interface Coupon {
  id: string;
  code: string;
  type: "Flat" | "Percent";
  value: number;
  limit: number;
  used: number;
  validTill: string;
  status: "Active" | "Expired" | "Paused";
}
const COUPONS: Coupon[] = [
  { id: "cp-1", code: "FLY500", type: "Flat", value: 500, limit: 1000, used: 642, validTill: "2025-03-31", status: "Active" },
  { id: "cp-2", code: "SUMMER20", type: "Percent", value: 20, limit: 5000, used: 1240, validTill: "2025-06-30", status: "Active" },
  { id: "cp-3", code: "GOA1500", type: "Flat", value: 1500, limit: 500, used: 412, validTill: "2025-02-15", status: "Active" },
  { id: "cp-4", code: "WINTERSALE", type: "Percent", value: 15, limit: 2000, used: 2000, validTill: "2024-12-31", status: "Expired" },
  { id: "cp-5", code: "HONEYMOON25", type: "Percent", value: 25, limit: 1000, used: 380, validTill: "2025-04-30", status: "Active" },
  { id: "cp-6", code: "BUS100", type: "Flat", value: 100, limit: 5000, used: 1820, validTill: "2025-05-31", status: "Paused" },
];

interface Promotion {
  id: string;
  title: string;
  description: string;
  discount: string;
  period: string;
  active: boolean;
  gradient: string;
}
const PROMOS_INIT: Promotion[] = [
  { id: "pr-1", title: "Republic Day Mega Sale", description: "Flat 25% off on all domestic flight bookings.", discount: "25% OFF", period: "Jan 20 – Jan 26", active: true, gradient: "from-teal-500 via-emerald-500 to-cyan-600" },
  { id: "pr-2", title: "Bali Bliss Bonanza", description: "Save ₹15,000 on 6N/7D Bali honeymoon packages.", discount: "₹15,000 OFF", period: "Until Feb 28", active: true, gradient: "from-amber-500 via-orange-500 to-rose-500" },
  { id: "pr-3", title: "Europe Early Bird", description: "Book 90 days ahead and save 20% on Europe tours.", discount: "20% OFF", period: "Feb 1 – Mar 31", active: true, gradient: "from-violet-500 via-purple-500 to-fuchsia-600" },
  { id: "pr-4", title: "Weekend Goa Flash Sale", description: "Last-minute Goa getaways from ₹4,999 only.", discount: "From ₹4,999", period: "Every weekend", active: false, gradient: "from-cyan-500 via-teal-500 to-emerald-600" },
];

const TYPE_ICON: Record<CampaignType, React.ElementType> = { Email: Mail, WhatsApp: MessageCircle, SMS: Send };
const TYPE_COLOR: Record<CampaignType, string> = {
  Email: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400",
  WhatsApp: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  SMS: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
};

function CampaignCard({ c, onAction }: { c: Campaign; onAction: (c: Campaign, action: string) => void }) {
  const Icon = TYPE_ICON[c.type];
  const openRate = c.sent ? Math.round((c.opened / c.sent) * 100) : 0;
  const clickRate = c.sent ? Math.round((c.clicked / c.sent) * 100) : 0;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }}>
      <Card className="h-full overflow-hidden hover:shadow-md transition-shadow">
        <div className={cn("h-16 bg-gradient-to-r relative", c.gradient)}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute top-2 right-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/20"><MoreHorizontal className="w-4 h-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => onAction(c, "edit")}><Pencil className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAction(c, "duplicate")}><Copy className="w-4 h-4 mr-2" /> Duplicate</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-rose-600" onClick={() => onAction(c, "delete")}><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="absolute -bottom-4 left-4 w-10 h-10 rounded-xl bg-white dark:bg-card flex items-center justify-center shadow-md">
            <Icon className={cn("w-5 h-5", TYPE_COLOR[c.type].split(" ")[0])} />
          </div>
        </div>
        <CardContent className="p-4 pt-6">
          <div className="flex items-center justify-between mb-1">
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", TYPE_COLOR[c.type])}>{c.type}</Badge>
            <StatusBadge status={c.status} className="text-[10px] px-1.5 py-0" />
          </div>
          <h3 className="font-semibold text-sm leading-snug line-clamp-2 mt-1">{c.name}</h3>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><Calendar className="w-3 h-3" />{c.date}</p>

          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div className="rounded-lg bg-muted/40 p-1.5">
              <p className="text-sm font-bold">{c.audience.toLocaleString("en-IN")}</p>
              <p className="text-[10px] text-muted-foreground">Audience</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-1.5">
              <p className="text-sm font-bold text-teal-600">{openRate}%</p>
              <p className="text-[10px] text-muted-foreground">Open Rate</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-1.5">
              <p className="text-sm font-bold text-amber-600">{clickRate}%</p>
              <p className="text-[10px] text-muted-foreground">Click Rate</p>
            </div>
          </div>

          <div className="space-y-1.5 mt-3">
            <div>
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="text-muted-foreground flex items-center gap-1"><Eye className="w-2.5 h-2.5" /> Opened</span>
                <span className="font-medium">{c.opened.toLocaleString("en-IN")} / {c.sent.toLocaleString("en-IN")}</span>
              </div>
              <Progress value={c.sent ? (c.opened / c.sent) * 100 : 0} className="h-1.5" />
            </div>
            <div>
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="text-muted-foreground flex items-center gap-1"><MousePointerClick className="w-2.5 h-2.5" /> Clicked</span>
                <span className="font-medium">{c.clicked.toLocaleString("en-IN")} / {c.sent.toLocaleString("en-IN")}</span>
              </div>
              <Progress value={c.sent ? (c.clicked / c.sent) * 100 : 0} className="h-1.5" />
            </div>
          </div>

          {c.status === "Running" && (
            <Button size="sm" variant="outline" className="w-full mt-3" onClick={() => onAction(c, "pause")}>
              <Pause className="w-3.5 h-3.5 mr-1" /> Pause Campaign
            </Button>
          )}
          {(c.status === "Scheduled" || c.status === "Draft") && (
            <Button size="sm" className="w-full mt-3 bg-gradient-to-r from-teal-600 to-emerald-600" onClick={() => onAction(c, "launch")}>
              <Play className="w-3.5 h-3.5 mr-1" /> Launch Now
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function MarketingView() {
  const { toast } = useToast();
  const [tab, setTab] = useState("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>(CAMPAIGNS);
  const [coupons, setCoupons] = useState<Coupon[]>(COUPONS);
  const [promos, setPromos] = useState<Promotion[]>(PROMOS_INIT);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  const [campaignForm, setCampaignForm] = useState({ name: "", type: "Email" as CampaignType, audience: "", message: "", schedule: "" });
  const [couponForm, setCouponForm] = useState({ code: "", type: "Flat" as "Flat" | "Percent", value: "", limit: "", validTill: "" });

  function handleCampaignAction(c: Campaign, action: string) {
    if (action === "delete") {
      setCampaigns((prev) => prev.filter((x) => x.id !== c.id));
      toast({ title: "Campaign deleted", description: c.name, variant: "destructive" });
      return;
    }
    if (action === "duplicate") {
      const dup = { ...c, id: `cm-${campaigns.length + 1}`, name: `${c.name} (Copy)`, status: "Draft" as CampaignStatus, sent: 0, opened: 0, clicked: 0 };
      setCampaigns([dup, ...campaigns]);
      toast({ title: "Campaign duplicated", description: dup.name });
      return;
    }
    if (action === "pause") {
      setCampaigns((prev) => prev.map((x) => x.id === c.id ? { ...x, status: "Scheduled" } : x));
      toast({ title: "Campaign paused", description: c.name });
      return;
    }
    if (action === "launch") {
      setCampaigns((prev) => prev.map((x) => x.id === c.id ? { ...x, status: "Running", sent: x.audience } : x));
      toast({ title: "Campaign launched", description: c.name });
      return;
    }
    toast({ title: action, description: c.name });
  }

  function createCampaign() {
    if (!campaignForm.name || !campaignForm.audience) {
      toast({ title: "Missing fields", description: "Name and audience required.", variant: "destructive" });
      return;
    }
    const newC: Campaign = {
      id: `cm-${campaigns.length + 1}`,
      name: campaignForm.name,
      type: campaignForm.type,
      audience: parseInt(campaignForm.audience) || 0,
      sent: 0, opened: 0, clicked: 0,
      status: campaignForm.schedule ? "Scheduled" : "Draft",
      date: campaignForm.schedule || new Date().toISOString().slice(0, 10),
      gradient: ["from-teal-500 to-emerald-600", "from-amber-500 to-orange-600", "from-violet-500 to-purple-600"][campaigns.length % 3],
    };
    setCampaigns([newC, ...campaigns]);
    setCampaignOpen(false);
    setCampaignForm({ name: "", type: "Email", audience: "", message: "", schedule: "" });
    toast({ title: "Campaign created", description: newC.name });
  }

  function createCoupon() {
    if (!couponForm.code || !couponForm.value) {
      toast({ title: "Missing fields", description: "Code and value required.", variant: "destructive" });
      return;
    }
    const newC: Coupon = {
      id: `cp-${coupons.length + 1}`,
      code: couponForm.code.toUpperCase(),
      type: couponForm.type,
      value: parseInt(couponForm.value) || 0,
      limit: parseInt(couponForm.limit) || 0,
      used: 0,
      validTill: couponForm.validTill || "2025-12-31",
      status: "Active",
    };
    setCoupons([newC, ...coupons]);
    setCouponOpen(false);
    setCouponForm({ code: "", type: "Flat", value: "", limit: "", validTill: "" });
    toast({ title: "Coupon created", description: newC.code });
  }

  const totalAudience = campaigns.reduce((s, c) => s + c.audience, 0);
  const avgOpen = campaigns.length ? Math.round(campaigns.reduce((s, c) => s + (c.sent ? (c.opened / c.sent) * 100 : 0), 0) / campaigns.length) : 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Marketing" subtitle="Campaigns, coupons, and promotions" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="campaigns"><Mail className="w-4 h-4 mr-1.5" /> Campaigns</TabsTrigger>
          <TabsTrigger value="coupons"><Ticket className="w-4 h-4 mr-1.5" /> Coupons</TabsTrigger>
          <TabsTrigger value="promotions"><Tag className="w-4 h-4 mr-1.5" /> Promotions</TabsTrigger>
        </TabsList>

        {/* CAMPAIGNS */}
        <TabsContent value="campaigns" className="mt-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">{campaigns.length} campaigns</Badge>
              <span>·</span>
              <span>{totalAudience.toLocaleString("en-IN")} total reach</span>
              <span>·</span>
              <span>{avgOpen}% avg open rate</span>
            </div>
            <Button className="bg-gradient-to-r from-teal-600 to-emerald-600" onClick={() => setCampaignOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Create Campaign
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Open Rate Trend</CardTitle>
                <CardDescription className="text-xs">Last 7 days · all active campaigns</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={CAMPAIGN_PERF} margin={{ left: -16, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient id="openGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0d9488" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="clickGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }} />
                    <Area type="monotone" dataKey="opens" stroke="#0d9488" strokeWidth={2.5} fill="url(#openGrad)" />
                    <Area type="monotone" dataKey="clicks" stroke="#f59e0b" strokeWidth={2.5} fill="url(#clickGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {campaigns.map((c) => <CampaignCard key={c.id} c={c} onAction={handleCampaignAction} />)}
            </div>
          </div>
        </TabsContent>

        {/* COUPONS */}
        <TabsContent value="coupons" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{coupons.length} coupons · {coupons.filter((c) => c.status === "Active").length} active</p>
            <Button className="bg-gradient-to-r from-teal-600 to-emerald-600" onClick={() => setCouponOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Create Coupon
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[28rem] overflow-auto scroll-thin">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-right">Usage</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Valid Till</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coupons.map((c) => (
                      <TableRow key={c.id} className="hover:bg-muted/40">
                        <TableCell>
                          <code className="text-xs font-mono font-semibold px-2 py-1 rounded bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400">{c.code}</code>
                        </TableCell>
                        <TableCell><Badge variant="outline" className={c.type === "Flat" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-violet-50 text-violet-700 border-violet-200"}>{c.type}</Badge></TableCell>
                        <TableCell className="text-right font-semibold">{c.type === "Flat" ? `₹${c.value}` : `${c.value}%`}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.used.toLocaleString("en-IN")} / {c.limit.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="w-32">
                          <div className="flex items-center gap-2">
                            <Progress value={c.limit ? (c.used / c.limit) * 100 : 0} className="h-1.5 w-20" />
                            <span className="text-[10px] text-muted-foreground">{c.limit ? Math.round((c.used / c.limit) * 100) : 0}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.validTill}</TableCell>
                        <TableCell><StatusBadge status={c.status} className="text-[10px] px-1.5 py-0" /></TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => toast({ title: "Copied", description: `${c.code} copied` })}><Copy className="w-4 h-4 mr-2" /> Copy Code</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toast({ title: "Edit coupon", description: c.code })}><Pencil className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-rose-600" onClick={() => { setCoupons((prev) => prev.filter((x) => x.id !== c.id)); toast({ title: "Coupon deleted", description: c.code, variant: "destructive" }); }}>
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PROMOTIONS */}
        <TabsContent value="promotions" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">{promos.filter((p) => p.active).length} active promotions running on the platform</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {promos.map((p) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }}>
                <Card className={cn("overflow-hidden hover:shadow-md transition-shadow", !p.active && "opacity-70")}>
                  <div className={cn("relative h-24 bg-gradient-to-r p-4 flex items-center justify-between", p.gradient)}>
                    <div>
                      <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm">{p.discount}</Badge>
                    </div>
                    <Switch checked={p.active} onCheckedChange={(v) => { setPromos((prev) => prev.map((x) => x.id === p.id ? { ...x, active: v } : x)); toast({ title: v ? "Promotion activated" : "Promotion paused", description: p.title }); }} />
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-sm">{p.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{p.description}</p>
                    <Separator className="my-2.5" />
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" />{p.period}</span>
                      <StatusBadge status={p.active ? "Active" : "Pending"} className="text-[10px] px-1.5 py-0" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            <button
              onClick={() => toast({ title: "Add promotion", description: "Opening promotion designer" })}
              className="rounded-xl border-2 border-dashed border-border hover:border-teal-400 hover:bg-muted/30 transition-colors flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground"
            >
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center"><ImageIcon className="w-5 h-5" /></div>
              <span className="text-xs font-medium">Add Promotion</span>
            </button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Campaign Dialog */}
      <Dialog open={campaignOpen} onOpenChange={setCampaignOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="w-5 h-5 text-teal-600" /> Create Campaign</DialogTitle>
            <DialogDescription>Set up a new marketing campaign.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cm-name">Campaign Name</Label>
              <Input id="cm-name" placeholder="e.g. Valentine's Day Sale" value={campaignForm.name} onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={campaignForm.type} onValueChange={(v) => setCampaignForm({ ...campaignForm, type: v as CampaignType })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    <SelectItem value="SMS">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cm-aud">Audience Size</Label>
                <Input id="cm-aud" type="number" placeholder="5000" value={campaignForm.audience} onChange={(e) => setCampaignForm({ ...campaignForm, audience: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cm-msg">Message Template</Label>
              <Textarea id="cm-msg" rows={3} placeholder="Hi {{name}}, book your dream trip now..." value={campaignForm.message} onChange={(e) => setCampaignForm({ ...campaignForm, message: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cm-sch">Schedule (optional)</Label>
              <Input id="cm-sch" type="date" value={campaignForm.schedule} onChange={(e) => setCampaignForm({ ...campaignForm, schedule: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCampaignOpen(false)}>Cancel</Button>
            <Button className="bg-gradient-to-r from-teal-600 to-emerald-600" onClick={createCampaign}>
              <Plus className="w-4 h-4 mr-1.5" /> Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Coupon Dialog */}
      <Dialog open={couponOpen} onOpenChange={setCouponOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Ticket className="w-5 h-5 text-teal-600" /> Create Coupon</DialogTitle>
            <DialogDescription>Add a new discount coupon.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cp-code">Coupon Code</Label>
              <Input id="cp-code" placeholder="FLY500" className="uppercase" value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Discount Type</Label>
                <Select value={couponForm.type} onValueChange={(v) => setCouponForm({ ...couponForm, type: v as "Flat" | "Percent" })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Flat">Flat (₹)</SelectItem>
                    <SelectItem value="Percent">Percent (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-val">Value</Label>
                <Input id="cp-val" type="number" placeholder="500" value={couponForm.value} onChange={(e) => setCouponForm({ ...couponForm, value: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-lim">Usage Limit</Label>
                <Input id="cp-lim" type="number" placeholder="1000" value={couponForm.limit} onChange={(e) => setCouponForm({ ...couponForm, limit: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-valid">Valid Till</Label>
                <Input id="cp-valid" type="date" value={couponForm.validTill} onChange={(e) => setCouponForm({ ...couponForm, validTill: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCouponOpen(false)}>Cancel</Button>
            <Button className="bg-gradient-to-r from-teal-600 to-emerald-600" onClick={createCoupon}>
              <Plus className="w-4 h-4 mr-1.5" /> Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
