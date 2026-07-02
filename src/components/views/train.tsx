"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrainFront, MapPin, Search, Star,
  CreditCard, Wallet, Building2, Loader2, ShieldCheck, ArrowRight,
  BadgeIndianRupee, Users, Utensils,
} from "lucide-react";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatFullINR, PageHeader } from "@/components/shared/ui-helpers";
import { cn } from "@/lib/utils";

const STATIONS = ["Mumbai Central", "Pune Jn", "Delhi Jn", "Bangalore Jn", "Chennai Central", "Hyderabad Jn", "Howrah Jn", "Ahmedabad Jn", "Jaipur Jn", "Goa Madgaon"];

const TRAIN_CLASSES = [
  { code: "SL", name: "Sleeper" },
  { code: "3A", name: "AC 3 Tier" },
  { code: "2A", name: "AC 2 Tier" },
  { code: "1A", name: "AC First" },
  { code: "CC", name: "Chair Car" },
  { code: "2S", name: "Second Sitting" },
];

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

interface TrainClass {
  code: string;
  fare: number;
  status: string; // "AVL 45", "WL 12", "RAC 8"
}
interface TrainResult {
  id: string;
  name: string;
  number: string;
  origin: string;
  destination: string;
  departTime: string;
  arriveTime: string;
  duration: string;
  runningDays: boolean[];
  classes: TrainClass[];
  rating: number;
  pantry: boolean;
}

const TRAINS: TrainResult[] = [
  {
    id: "tr-1", name: "Rajdhani Express", number: "12951", origin: "Mumbai Central", destination: "Delhi Jn",
    departTime: "17:00", arriveTime: "08:35", duration: "15h 35m", rating: 4.6, pantry: true,
    runningDays: [true, true, true, true, true, true, true],
    classes: [
      { code: "3A", fare: 2350, status: "AVL 45" },
      { code: "2A", fare: 3380, status: "AVL 12" },
      { code: "1A", fare: 5670, status: "RAC 4" },
    ],
  },
  {
    id: "tr-2", name: "Duronto Express", number: "12259", origin: "Mumbai Central", destination: "Delhi Jn",
    departTime: "23:05", arriveTime: "16:30", duration: "17h 25m", rating: 4.4, pantry: true,
    runningDays: [true, true, false, true, true, false, true],
    classes: [
      { code: "SL", fare: 880, status: "WL 12" },
      { code: "3A", fare: 2210, status: "AVL 28" },
      { code: "2A", fare: 3180, status: "RAC 8" },
    ],
  },
  {
    id: "tr-3", name: "Garib Rath Express", number: "12909", origin: "Mumbai Central", destination: "Delhi Jn",
    departTime: "15:35", arriveTime: "10:55", duration: "19h 20m", rating: 4.1, pantry: false,
    runningDays: [true, false, true, false, true, true, false],
    classes: [
      { code: "CC", fare: 1240, status: "AVL 60" },
      { code: "2S", fare: 540, status: "AVL 120" },
    ],
  },
  {
    id: "tr-4", name: "Mumbai Rajdhani", number: "12953", origin: "Mumbai Central", destination: "Delhi Jn",
    departTime: "16:25", arriveTime: "08:15", duration: "15h 50m", rating: 4.7, pantry: true,
    runningDays: [true, true, true, true, true, true, true],
    classes: [
      { code: "3A", fare: 2410, status: "AVL 22" },
      { code: "2A", fare: 3450, status: "AVL 5" },
      { code: "1A", fare: 5810, status: "WL 3" },
    ],
  },
  {
    id: "tr-5", name: "August Kranti Rajdhani", number: "12953", origin: "Mumbai Central", destination: "Delhi Jn",
    departTime: "17:40", arriveTime: "09:55", duration: "16h 15m", rating: 4.5, pantry: true,
    runningDays: [false, true, true, true, true, true, true],
    classes: [
      { code: "SL", fare: 920, status: "RAC 18" },
      { code: "3A", fare: 2380, status: "WL 8" },
      { code: "2A", fare: 3420, status: "AVL 3" },
    ],
  },
  {
    id: "tr-6", name: "Pune Duronto", number: "12297", origin: "Mumbai Central", destination: "Delhi Jn",
    departTime: "11:10", arriveTime: "05:45", duration: "18h 35m", rating: 4.3, pantry: true,
    runningDays: [true, true, true, false, true, false, true],
    classes: [
      { code: "SL", fare: 870, status: "AVL 75" },
      { code: "3A", fare: 2190, status: "AVL 40" },
      { code: "2A", fare: 3140, status: "RAC 6" },
    ],
  },
];

function statusColor(status: string) {
  if (status.startsWith("AVL")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border-0";
  if (status.startsWith("RAC")) return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 border-0";
  if (status.startsWith("WL")) return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 border-0";
  return "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300 border-0";
}

function PaymentModal({
  amount, open, onClose, onSuccess, title,
}: {
  amount: number; open: boolean; onClose: () => void; onSuccess: () => void; title: string;
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
        title: "Ticket Confirmed!",
        description: `${formatFullINR(amount)} paid. Your train ticket is booked. PNR: ${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
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
              <DialogDescription>{title}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-lg bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/30 dark:to-emerald-950/30 border border-teal-200 dark:border-teal-900 p-4 text-center">
          <p className="text-xs text-muted-foreground">Total Payable</p>
          <p className="text-3xl font-bold text-teal-700 dark:text-teal-300 mt-1">{formatFullINR(amount)}</p>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3" /> IRCTC • 256-bit encrypted
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
                <input type="radio" name="nb" defaultChecked={b === "HDFC Bank"} className="accent-teal-600" />
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

interface Passenger {
  name: string; age: string; gender: "Male" | "Female" | "Other"; berth: string;
}

export function TrainView() {
  const { toast } = useToast();
  const [fromStation, setFromStation] = useState("Mumbai Central");
  const [toStation, setToStation] = useState("Delhi Jn");
  const [date, setDate] = useState("2025-02-20");
  const [trainClass, setTrainClass] = useState("3A");
  const [searched, setSearched] = useState(false);

  const [bookingTrain, setBookingTrain] = useState<TrainResult | null>(null);
  const [bookingClassCode, setBookingClassCode] = useState<string>("");
  const [passengers, setPassengers] = useState<Passenger[]>([{ name: "", age: "", gender: "Male", berth: "No Preference" }]);
  const [payOpen, setPayOpen] = useState(false);

  const handleSearch = () => {
    if (fromStation === toStation) {
      toast({ title: "Invalid route", description: "From and To stations cannot be the same.", variant: "destructive" });
      return;
    }
    setSearched(true);
  };

  const filteredTrains = useMemo(() => TRAINS, []);

  const isWaitlist = (status: string) => status.startsWith("WL");

  const openBooking = (train: TrainResult, classCode: string) => {
    setBookingTrain(train);
    setBookingClassCode(classCode);
    setPassengers([{ name: "", age: "", gender: "Male", berth: "No Preference" }]);
  };

  const selectedClass = bookingTrain?.classes.find((c) => c.code === bookingClassCode);
  const totalFare = (selectedClass?.fare || 0) * passengers.length;

  const addPassenger = () => setPassengers((p) => [...p, { name: "", age: "", gender: "Male", berth: "No Preference" }]);
  const removePassenger = (i: number) => setPassengers((p) => p.filter((_, idx) => idx !== i));
  const updatePassenger = (i: number, field: keyof Passenger, value: string) =>
    setPassengers((p) => p.map((pas, idx) => (idx === i ? { ...pas, [field]: value } : pas)));

  const handlePayNow = () => {
    if (passengers.some((p) => !p.name.trim() || !p.age.trim())) {
      toast({ title: "Incomplete details", description: "Please fill all passenger names and ages.", variant: "destructive" });
      return;
    }
    setBookingTrain(null);
    setPayOpen(true);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Train Booking" subtitle="Book IRCTC trains across India — Rajdhani, Duronto, Shatabdi & more." />

      {/* Search Panel */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-600 via-rose-700 to-orange-700 text-white p-5 lg:p-6 shadow-lg"
      >
        <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-12 w-56 h-56 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-3">
            <Label className="text-rose-100 text-xs">From Station</Label>
            <Select value={fromStation} onValueChange={setFromStation}>
              <SelectTrigger className="w-full bg-white/95 text-slate-800 border-0 mt-1 h-11">
                <MapPin className="w-4 h-4 mr-1 text-rose-600" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="hidden md:flex md:col-span-1 items-center justify-center pb-2">
            <button
              onClick={() => { setFromStation(toStation); setToStation(fromStation); }}
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
              title="Swap"
            >
              <ArrowRight className="w-4 h-4 md:-rotate-90" />
            </button>
          </div>
          <div className="md:col-span-3">
            <Label className="text-rose-100 text-xs">To Station</Label>
            <Select value={toStation} onValueChange={setToStation}>
              <SelectTrigger className="w-full bg-white/95 text-slate-800 border-0 mt-1 h-11">
                <MapPin className="w-4 h-4 mr-1 text-orange-600" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-rose-100 text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-white/95 text-slate-800 border-0 mt-1 h-11" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-rose-100 text-xs">Class</Label>
            <Select value={trainClass} onValueChange={setTrainClass}>
              <SelectTrigger className="w-full bg-white/95 text-slate-800 border-0 mt-1 h-11">
                <TrainFront className="w-4 h-4 mr-1 text-rose-600" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRAIN_CLASSES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1">
            <Button onClick={handleSearch} size="lg" className="w-full h-11 bg-amber-400 hover:bg-amber-300 text-amber-950 font-semibold">
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </motion.div>

      {!searched ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Fastest", train: "Rajdhani Express", time: "15h 35m", color: "from-teal-500 to-emerald-600" },
            { label: "Cheapest", train: "Garib Rath", time: "₹540 onwards", color: "from-amber-500 to-orange-600" },
            { label: "Premium", train: "August Kranti", time: "AC 1A", color: "from-rose-500 to-pink-600" },
            { label: "Daily", train: "Duronto Express", time: "7 days a week", color: "from-violet-500 to-purple-600" },
          ].map((c) => (
            <Card key={c.label} className="overflow-hidden">
              <CardContent className="p-4">
                <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r text-white text-[10px] font-medium", c.color)}>
                  <Star className="w-2.5 h-2.5" /> {c.label}
                </div>
                <p className="font-semibold text-sm mt-2">{c.train}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{c.time}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{filteredTrains.length}</span> trains found from <span className="font-medium">{fromStation}</span> to <span className="font-medium">{toStation}</span>
            </p>
            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
              {trainClass} — {TRAIN_CLASSES.find((c) => c.code === trainClass)?.name}
            </Badge>
          </div>

          {filteredTrains.map((train, i) => (
            <motion.div key={train.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    {/* Train info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-base flex items-center gap-2">
                          <TrainFront className="w-4 h-4 text-rose-600" /> {train.name}
                        </h3>
                        <Badge variant="outline" className="text-[10px] font-mono"># {train.number}</Badge>
                        <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {train.rating}
                        </span>
                        {train.pantry && (
                          <Badge className="text-[10px] bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300 border-0">
                            <Utensils className="w-3 h-3 mr-0.5" /> Pantry
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-3">
                        <div className="text-center min-w-[60px]">
                          <p className="text-xl font-bold tracking-tight">{train.departTime}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{train.origin}</p>
                        </div>
                        <div className="flex-1 flex flex-col items-center min-w-[80px]">
                          <p className="text-[10px] text-muted-foreground">{train.duration}</p>
                          <div className="w-full h-px bg-border relative my-1">
                            <TrainFront className="w-3 h-3 absolute -top-1.5 left-1/2 -translate-x-1/2 text-rose-600 bg-card px-0.5" />
                          </div>
                          <p className="text-[10px] text-muted-foreground">Non-stop</p>
                        </div>
                        <div className="text-center min-w-[60px]">
                          <p className="text-xl font-bold tracking-tight">{train.arriveTime}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{train.destination}</p>
                        </div>
                      </div>

                      {/* Running days */}
                      <div className="flex items-center gap-1 mt-3">
                        {DAYS.map((d, idx) => (
                          <span key={idx} className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium border",
                            train.runningDays[idx]
                              ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-700"
                              : "bg-muted text-muted-foreground border-border"
                          )}>
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Class availability table */}
                    <div className="lg:min-w-[340px]">
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-muted/50 text-muted-foreground">
                              <th className="text-left font-medium px-3 py-1.5">Class</th>
                              <th className="text-left font-medium px-3 py-1.5">Fare</th>
                              <th className="text-left font-medium px-3 py-1.5">Availability</th>
                              <th className="px-2 py-1.5"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {train.classes.map((c) => {
                              const wl = isWaitlist(c.status);
                              return (
                                <tr key={c.code} className="border-t hover:bg-muted/30">
                                  <td className="px-3 py-2 font-semibold">{c.code}</td>
                                  <td className="px-3 py-2 text-muted-foreground">{formatFullINR(c.fare)}</td>
                                  <td className="px-3 py-2">
                                    <span className={cn("text-[10px] px-2 py-0.5 rounded font-medium", statusColor(c.status))}>{c.status}</span>
                                  </td>
                                  <td className="px-2 py-2">
                                    <Button
                                      size="sm"
                                      disabled={wl}
                                      onClick={() => openBooking(train, c.code)}
                                      className={cn("h-7 text-[11px] px-2", wl ? "opacity-50" : "bg-rose-600 hover:bg-rose-700")}
                                    >
                                      {wl ? "WL" : "Book"}
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Booking Dialog */}
      <Dialog open={!!bookingTrain} onOpenChange={(o) => !o && setBookingTrain(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {bookingTrain && selectedClass && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <TrainFront className="w-5 h-5 text-rose-600" /> Passenger Details
                </DialogTitle>
                <DialogDescription>
                  {bookingTrain.name} ({bookingTrain.number}) • Class {bookingClassCode} • {bookingTrain.departTime} → {bookingTrain.arriveTime}
                </DialogDescription>
              </DialogHeader>

              <div className="overflow-y-auto scroll-thin -mx-1 px-1 space-y-3">
                <AnimatePresence mode="popLayout">
                  {passengers.map((p, i) => (
                    <motion.div
                      key={i}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground">Passenger {i + 1}</p>
                        {passengers.length > 1 && (
                          <Button variant="ghost" size="sm" className="h-6 text-xs text-rose-600" onClick={() => removePassenger(i)}>
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[11px]">Full Name</Label>
                          <Input
                            value={p.name}
                            onChange={(e) => updatePassenger(i, "name", e.target.value)}
                            placeholder="As per ID proof"
                            className="h-8 text-sm mt-0.5"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[11px]">Age</Label>
                            <Input
                              type="number"
                              value={p.age}
                              onChange={(e) => updatePassenger(i, "age", e.target.value)}
                              placeholder="30"
                              className="h-8 text-sm mt-0.5"
                            />
                          </div>
                          <div>
                            <Label className="text-[11px]">Gender</Label>
                            <Select value={p.gender} onValueChange={(v) => updatePassenger(i, "gender", v)}>
                              <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Male">Male</SelectItem>
                                <SelectItem value="Female">Female</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label className="text-[11px]">Berth Preference</Label>
                        <RadioGroup
                          value={p.berth}
                          onValueChange={(v) => updatePassenger(i, "berth", v)}
                          className="flex flex-wrap gap-x-4 gap-y-1 mt-1"
                        >
                          {["No Preference", "Lower", "Middle", "Upper", "Side Lower", "Side Upper"].map((b) => (
                            <label key={b} className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <RadioGroupItem value={b} className="w-3 h-3" /> {b}
                            </label>
                          ))}
                        </RadioGroup>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {passengers.length < 6 && (
                  <Button variant="outline" size="sm" onClick={addPassenger} className="w-full border-dashed">
                    <Users className="w-3.5 h-3.5" /> Add Passenger
                  </Button>
                )}

                {/* Fare summary */}
                <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Base Fare ({bookingClassCode})</span><span className="font-medium">{formatFullINR(selectedClass.fare)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Passengers</span><span className="font-medium">{passengers.length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">IRCTC + GST</span><span className="font-medium">{formatFullINR(35 * passengers.length)}</span></div>
                  <Separator className="my-1" />
                  <div className="flex justify-between text-sm"><span className="font-semibold">Total Fare</span><span className="font-bold text-rose-700 dark:text-rose-300">{formatFullINR(totalFare + 35 * passengers.length)}</span></div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setBookingTrain(null)}>Cancel</Button>
                <Button onClick={handlePayNow} className="bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-700 hover:to-orange-700">
                  <CreditCard className="w-4 h-4" /> Pay {formatFullINR(totalFare + 35 * passengers.length)}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <PaymentModal
        open={payOpen}
        amount={totalFare + 35 * passengers.length}
        title={`${bookingTrain?.name || "Train"} • ${passengers.length} passenger(s)`}
        onClose={() => setPayOpen(false)}
        onSuccess={() => { setPassengers([{ name: "", age: "", gender: "Male", berth: "No Preference" }]); }}
      />
    </div>
  );
}
