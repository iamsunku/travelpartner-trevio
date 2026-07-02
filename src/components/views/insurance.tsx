"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Shield, ShieldCheck, Plane, HeartPulse, XCircle, PlaneTakeoff,
  CreditCard, Wallet, Building2, Loader2, BadgeIndianRupee,
  CheckCircle2, X, Clock, FileText, AlertCircle,
  Sparkles, BriefcaseMedical, Activity, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, StatusBadge, formatFullINR } from "@/components/shared/ui-helpers";
import { cn } from "@/lib/utils";

interface Plan {
  id: string;
  name: string;
  tagline: string;
  coverage: number;
  premium: number;
  icon: typeof Plane;
  gradient: string;
  badgeColor: string;
  popular?: boolean;
  features: { label: string; included: boolean }[];
}

const PLANS: Plan[] = [
  {
    id: "travel-shield",
    name: "Travel Shield",
    tagline: "Complete travel protection for leisure & business trips",
    coverage: 5000000,
    premium: 2499,
    icon: Plane,
    gradient: "from-teal-500 via-emerald-500 to-cyan-600",
    badgeColor: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
    features: [
      { label: "Trip Cancellation", included: true },
      { label: "Medical Emergencies (₹3L)", included: true },
      { label: "Baggage Loss / Delay", included: true },
      { label: "Flight Delay (>6h)", included: true },
      { label: "Adventure Sports Cover", included: false },
      { label: "Pre-existing Conditions", included: false },
      { label: "Evacuation & Repatriation", included: true },
      { label: "Personal Liability", included: true },
    ],
  },
  {
    id: "medical-protect",
    name: "Medical Protect",
    tagline: "Comprehensive medical cover for international travellers",
    coverage: 10000000,
    premium: 4999,
    icon: HeartPulse,
    gradient: "from-rose-500 via-rose-600 to-pink-700",
    badgeColor: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    popular: true,
    features: [
      { label: "Trip Cancellation", included: true },
      { label: "Medical Emergencies (₹10L)", included: true },
      { label: "Baggage Loss / Delay", included: true },
      { label: "Flight Delay (>6h)", included: true },
      { label: "Adventure Sports Cover", included: true },
      { label: "Pre-existing Conditions", included: true },
      { label: "Evacuation & Repatriation", included: true },
      { label: "Personal Liability", included: true },
    ],
  },
  {
    id: "cancellation-plus",
    name: "Cancellation Plus",
    tagline: "Budget cover for trip cancellation & interruptions",
    coverage: 2500000,
    premium: 1799,
    icon: PlaneTakeoff,
    gradient: "from-amber-500 via-orange-500 to-rose-500",
    badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    features: [
      { label: "Trip Cancellation", included: true },
      { label: "Medical Emergencies (₹1L)", included: true },
      { label: "Baggage Loss / Delay", included: false },
      { label: "Flight Delay (>12h)", included: true },
      { label: "Adventure Sports Cover", included: false },
      { label: "Pre-existing Conditions", included: false },
      { label: "Evacuation & Repatriation", included: false },
      { label: "Personal Liability", included: false },
    ],
  },
];

const CLAIM_STEPS = [
  { id: 1, label: "Filed", icon: FileText, color: "text-slate-600 bg-slate-100 dark:bg-slate-700/50" },
  { id: 2, label: "Under Review", icon: Clock, color: "text-amber-600 bg-amber-100 dark:bg-amber-900/40" },
  { id: 3, label: "Approved", icon: CheckCircle2, color: "text-teal-600 bg-teal-100 dark:bg-teal-900/40" },
  { id: 4, label: "Settled", icon: Sparkles, color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40" },
];

interface Claim {
  id: string;
  type: string;
  amount: number;
  status: "Filed" | "Under Review" | "Approved" | "Settled" | "Rejected";
  date: string;
  description: string;
}

const CLAIMS: Claim[] = [
  { id: "CL-2025-0451", type: "Medical Reimbursement", amount: 45000, status: "Settled", date: "2024-12-15", description: "Hospital expenses in Bangkok — food poisoning treatment" },
  { id: "CL-2025-0462", type: "Baggage Loss", amount: 28000, status: "Approved", date: "2025-01-08", description: "Lost checked-in bag at Dubai airport" },
  { id: "CL-2025-0471", type: "Trip Cancellation", amount: 67000, status: "Under Review", date: "2025-01-17", description: "Cancelled Bali trip due to family emergency" },
  { id: "CL-2025-0478", type: "Flight Delay", amount: 8500, status: "Filed", date: "2025-01-19", description: "Mumbai-Delhi flight delayed by 9 hours" },
  { id: "CL-2025-0440", type: "Adventure Sports Injury", amount: 52000, status: "Rejected", date: "2024-11-22", description: "Scuba diving injury — out of coverage scope" },
];

function stepIndex(status: Claim["status"]) {
  if (status === "Filed") return 0;
  if (status === "Under Review") return 1;
  if (status === "Approved") return 2;
  if (status === "Settled") return 3;
  if (status === "Rejected") return -1;
  return 0;
}

function PaymentModal({
  amount, planName, open, onClose, onSuccess,
}: {
  amount: number; planName: string; open: boolean; onClose: () => void; onSuccess: () => void;
}) {
  const [method, setMethod] = useState("card");
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const handlePay = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      onClose();
      toast({
        title: "Policy Activated!",
        description: `${formatFullINR(amount)} paid for ${planName}. Policy document sent to your email. Coverage starts immediately.`,
      });
      onSuccess();
    }, 1800);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base">Razorpay Secure Payment</DialogTitle>
              <DialogDescription>{planName} • Annual Policy</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-lg bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/30 dark:to-emerald-950/30 border border-teal-200 dark:border-teal-900 p-4 text-center">
          <p className="text-xs text-muted-foreground">Annual Premium</p>
          <p className="text-3xl font-bold text-teal-700 dark:text-teal-300 mt-1">{formatFullINR(amount)}</p>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3" /> 256-bit encrypted • Instant policy activation
          </p>
        </div>

        <Tabs value={method} onValueChange={setMethod}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="card"><CreditCard className="w-3.5 h-3.5 mr-1" /> Card</TabsTrigger>
            <TabsTrigger value="upi"><Wallet className="w-3.5 h-3.5 mr-1" /> UPI</TabsTrigger>
            <TabsTrigger value="netbanking"><Building2 className="w-3.5 h-3.5 mr-1" /> Net</TabsTrigger>
          </TabsList>
          <TabsContent value="card" className="space-y-3 mt-3">
            <Input placeholder="Card Number • 4111 1111 1111 1111" />
            <div className="grid grid-cols-2 gap-2"><Input placeholder="MM / YY" /><Input placeholder="CVV" /></div>
            <Input placeholder="Cardholder Name" />
          </TabsContent>
          <TabsContent value="upi" className="space-y-3 mt-3">
            <Input placeholder="yourname@upi" />
            <p className="text-xs text-muted-foreground">A collect request will be sent to your UPI app.</p>
          </TabsContent>
          <TabsContent value="netbanking" className="space-y-2 mt-3">
            {["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank"].map((b) => (
              <label key={b} className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-muted/50 text-sm">
                <input type="radio" name="nb-ins" defaultChecked={b === "HDFC Bank"} className="accent-teal-600" />
                {b}
              </label>
            ))}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={processing}>Cancel</Button>
          <Button onClick={handlePay} disabled={processing} className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700">
            {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</> : <><BadgeIndianRupee className="w-4 h-4" /> Pay {formatFullINR(amount)}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InsuranceView() {
  const [payPlan, setPayPlan] = useState<Plan | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Travel Insurance"
        subtitle="Protect your trips with comprehensive travel, medical & cancellation cover. Compare plans, buy online & track claims."
        action={
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border-0">
            <Shield className="w-3.5 h-3.5 mr-1" /> IRDAI Licensed
          </Badge>
        }
      />

      <Tabs defaultValue="plans">
        <TabsList className="grid w-full md:w-auto grid-cols-2">
          <TabsTrigger value="plans"><Shield className="w-4 h-4 mr-1.5" /> Plans & Pricing</TabsTrigger>
          <TabsTrigger value="claims"><Activity className="w-4 h-4 mr-1.5" /> Claims Tracker</TabsTrigger>
        </TabsList>

        {/* Plans tab */}
        <TabsContent value="plans" className="space-y-5 mt-4">
          {/* Hero stat strip */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-700 text-white p-4 lg:p-5 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {[
              { icon: Plane, label: "Policies Issued", value: "1,84,520+" },
              { icon: TrendingUp, label: "Claims Settled", value: "₹42 Cr+" },
              { icon: Clock, label: "Avg. Claim Time", value: "7 days" },
              { icon: HeartPulse, label: "Claim Approval", value: "94%" },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-lg font-bold leading-tight">{s.value}</p>
                    <p className="text-[11px] text-white/80">{s.label}</p>
                  </div>
                </div>
              );
            })}
          </motion.div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map((plan, i) => {
              const Icon = plan.icon;
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ y: -4 }}
                >
                  <Card className={cn("relative overflow-hidden h-full flex flex-col", plan.popular && "border-teal-500 shadow-lg ring-2 ring-teal-500/20")}>
                    {plan.popular && (
                      <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> MOST POPULAR
                      </div>
                    )}
                    <div className={cn("h-24 bg-gradient-to-br p-4 text-white flex items-center gap-3", plan.gradient)}>
                      <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg leading-tight">{plan.name}</h3>
                        <p className="text-[11px] text-white/85 line-clamp-1">{plan.tagline}</p>
                      </div>
                    </div>

                    <CardContent className="p-4 flex-1 flex flex-col">
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-[11px] text-muted-foreground">Coverage up to</p>
                          <p className="text-2xl font-bold text-teal-700 dark:text-teal-300">{formatFullINR(plan.coverage)}</p>
                        </div>
                        <Badge className={plan.badgeColor}>{plan.premium / 100} yr</Badge>
                      </div>

                      <Separator className="my-3" />

                      <div className="space-y-1.5 flex-1">
                        {plan.features.slice(0, 5).map((f) => (
                          <div key={f.label} className="flex items-center gap-2 text-xs">
                            {f.included ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span className={cn(!f.included && "text-muted-foreground line-through")}>{f.label}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 pt-3 border-t">
                        <div className="flex items-end justify-between mb-2">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Annual Premium</p>
                            <p className="text-xl font-bold">{formatFullINR(plan.premium)}</p>
                          </div>
                          <p className="text-[10px] text-muted-foreground">GST incl.</p>
                        </div>
                        <Button
                          onClick={() => setPayPlan(plan)}
                          className={cn("w-full", plan.popular
                            ? "bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700"
                            : "bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white")}
                        >
                          <ShieldCheck className="w-4 h-4" /> Buy Now
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Comparison table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BriefcaseMedical className="w-4 h-4 text-teal-600" /> Feature Comparison
              </CardTitle>
              <CardDescription>Compare coverage across all plans side-by-side.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground">
                      <th className="text-left font-medium px-3 py-2.5">Feature</th>
                      {PLANS.map((p) => (
                        <th key={p.id} className="text-center font-semibold px-3 py-2.5 text-foreground">
                          {p.name}
                          {p.popular && <Badge className="ml-1 text-[9px] bg-amber-100 text-amber-700 border-0">★</Badge>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Coverage row */}
                    <tr className="border-t">
                      <td className="px-3 py-2.5 font-medium">Coverage Amount</td>
                      {PLANS.map((p) => (
                        <td key={p.id} className="px-3 py-2.5 text-center font-bold text-teal-700 dark:text-teal-300">{formatFullINR(p.coverage)}</td>
                      ))}
                    </tr>
                    <tr className="border-t">
                      <td className="px-3 py-2.5 font-medium">Annual Premium</td>
                      {PLANS.map((p) => (
                        <td key={p.id} className="px-3 py-2.5 text-center font-semibold">{formatFullINR(p.premium)}</td>
                      ))}
                    </tr>
                    {/* Per-feature rows */}
                    {PLANS[0].features.map((feature, idx) => (
                      <tr key={feature.label} className={cn("border-t hover:bg-muted/30", idx % 2 === 1 && "bg-muted/10")}>
                        <td className="px-3 py-2.5">{feature.label}</td>
                        {PLANS.map((p) => (
                          <td key={p.id} className="px-3 py-2.5 text-center">
                            {p.features[idx].included ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                            ) : (
                              <X className="w-4 h-4 text-muted-foreground/50 mx-auto" />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Claims tab */}
        <TabsContent value="claims" className="space-y-4 mt-4">
          {/* Horizontal tracker */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-600" /> Claim Lifecycle Tracker
                </CardTitle>
                <CardDescription>Tap a claim below to see its live status here.</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedClaim ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                      <div>
                        <p className="font-mono text-xs font-semibold text-rose-700 dark:text-rose-300">{selectedClaim.id}</p>
                        <p className="text-sm font-medium">{selectedClaim.type}</p>
                        <p className="text-xs text-muted-foreground">{selectedClaim.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-muted-foreground">Claim Amount</p>
                        <p className="text-xl font-bold text-rose-700 dark:text-rose-300">{formatFullINR(selectedClaim.amount)}</p>
                      </div>
                    </div>

                    {selectedClaim.status === "Rejected" ? (
                      <Alert variant="destructive">
                        <XCircle className="w-4 h-4" />
                        <AlertDescription>
                          <span className="font-semibold">Claim Rejected.</span> The incident was outside the coverage scope of your policy. For queries, contact our claims support.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="relative">
                        {/* Progress line */}
                        <div className="absolute top-5 left-5 right-5 h-1 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${(stepIndex(selectedClaim.status) / 3) * 100}%` }}
                            transition={{ duration: 0.6 }}
                          />
                        </div>
                        {/* Steps */}
                        <div className="relative grid grid-cols-4 gap-2">
                          {CLAIM_STEPS.map((step, idx) => {
                            const Icon = step.icon;
                            const reached = idx <= stepIndex(selectedClaim.status);
                            const isCurrent = idx === stepIndex(selectedClaim.status);
                            return (
                              <div key={step.id} className="flex flex-col items-center text-center">
                                <motion.div
                                  initial={{ scale: 0.8 }}
                                  animate={{ scale: isCurrent ? 1.1 : 1 }}
                                  className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                                    reached ? cn(step.color, "border-transparent") : "bg-background border-border text-muted-foreground"
                                  )}
                                >
                                  <Icon className="w-5 h-5" />
                                </motion.div>
                                <p className={cn("text-[11px] font-medium mt-1.5", isCurrent && "text-foreground")}>{step.label}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    Select a claim below to view its real-time status tracker.
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Claims list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-rose-600" /> All Claims
              </CardTitle>
              <CardDescription>Your recent insurance claims and their current status.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {CLAIMS.map((claim) => (
                  <button
                    key={claim.id}
                    onClick={() => setSelectedClaim(claim)}
                    className={cn(
                      "w-full text-left rounded-lg border p-3 transition-all hover:shadow-sm",
                      selectedClaim?.id === claim.id ? "border-rose-400 bg-rose-50/30 dark:bg-rose-950/10" : "hover:border-rose-200 dark:hover:border-rose-900"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                          claim.status === "Settled" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40" :
                          claim.status === "Approved" ? "bg-teal-100 text-teal-600 dark:bg-teal-900/40" :
                          claim.status === "Under Review" ? "bg-amber-100 text-amber-600 dark:bg-amber-900/40" :
                          claim.status === "Rejected" ? "bg-rose-100 text-rose-600 dark:bg-rose-900/40" :
                          "bg-slate-100 text-slate-600 dark:bg-slate-700/50"
                        )}>
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-mono text-xs font-semibold text-rose-700 dark:text-rose-300">{claim.id}</p>
                            <span className="text-xs text-muted-foreground">•</span>
                            <p className="text-xs text-muted-foreground">{claim.date}</p>
                          </div>
                          <p className="text-sm font-medium mt-0.5 truncate">{claim.type}</p>
                          <p className="text-xs text-muted-foreground truncate">{claim.description}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p className="font-bold text-sm">{formatFullINR(claim.amount)}</p>
                        <StatusBadge status={claim.status} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <Alert className="mt-4 bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800">
                <AlertCircle className="w-4 h-4 text-teal-600" />
                <AlertDescription className="text-xs text-teal-700 dark:text-teal-300">
                  <span className="font-semibold">Need to file a claim?</span> Submit documents within 30 days of incident. Average settlement time: 7 business days.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PaymentModal
        amount={payPlan?.premium || 0}
        planName={payPlan?.name || ""}
        open={!!payPlan}
        onClose={() => setPayPlan(null)}
        onSuccess={() => setPayPlan(null)}
      />
    </div>
  );
}
