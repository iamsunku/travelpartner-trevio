"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrainFront, MapPin, Search, Star,
  ArrowRight, Users, Utensils, CreditCard,
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
import { useToast } from "@/hooks/use-toast";
import { formatFullINR, PageHeader } from "@/components/shared/ui-helpers";
import { CitySearchField, type CityOption } from "@/components/shared/city-search-field";
import { PaymentModal, type BookingPaymentMethod } from "@/components/shared/payment-modal";
import { useDemoDataStore } from "@/store/demo-data-store";
import { cn } from "@/lib/utils";

const STATIONS: CityOption[] = [
  // Maharashtra
  { value: "Mumbai Central", label: "Mumbai Central", sublabel: "MMCT, Maharashtra" },
  { value: "Chhatrapati Shivaji Mah. Terminus", label: "Chhatrapati Shivaji Mah. Terminus", sublabel: "CSMT, Mumbai" },
  { value: "Dadar", label: "Dadar", sublabel: "DR, Mumbai" },
  { value: "Lokmanya Tilak Terminus", label: "Lokmanya Tilak Terminus", sublabel: "LTT, Mumbai" },
  { value: "Pune Jn", label: "Pune Jn", sublabel: "PUNE, Maharashtra" },
  { value: "Nagpur Jn", label: "Nagpur Jn", sublabel: "NGP, Maharashtra" },
  { value: "Nashik Road", label: "Nashik Road", sublabel: "NK, Maharashtra" },
  { value: "Aurangabad", label: "Aurangabad", sublabel: "AWB, Maharashtra" },
  { value: "Solapur Jn", label: "Solapur Jn", sublabel: "SUR, Maharashtra" },
  { value: "Kolhapur", label: "Kolhapur", sublabel: "KOP, Maharashtra" },
  // Delhi & NCR
  { value: "New Delhi", label: "New Delhi", sublabel: "NDLS, Delhi" },
  { value: "Delhi Jn", label: "Delhi Jn", sublabel: "DLI, Delhi" },
  { value: "Hazrat Nizamuddin", label: "Hazrat Nizamuddin", sublabel: "NZM, Delhi" },
  { value: "Anand Vihar Terminal", label: "Anand Vihar Terminal", sublabel: "ANVT, Delhi" },
  // Karnataka
  { value: "Bangalore Jn (KSR)", label: "Bangalore Jn (KSR)", sublabel: "SBC, Karnataka" },
  { value: "Mysuru Jn", label: "Mysuru Jn", sublabel: "MYS, Karnataka" },
  { value: "Hubballi Jn", label: "Hubballi Jn", sublabel: "UBL, Karnataka" },
  // Tamil Nadu
  { value: "Chennai Central", label: "Chennai Central", sublabel: "MAS, Tamil Nadu" },
  { value: "Chennai Egmore", label: "Chennai Egmore", sublabel: "MS, Tamil Nadu" },
  { value: "Coimbatore Jn", label: "Coimbatore Jn", sublabel: "CBE, Tamil Nadu" },
  { value: "Madurai Jn", label: "Madurai Jn", sublabel: "MDU, Tamil Nadu" },
  { value: "Tiruchirappalli Jn", label: "Tiruchirappalli Jn", sublabel: "TPJ, Tamil Nadu" },
  { value: "Salem Jn", label: "Salem Jn", sublabel: "SA, Tamil Nadu" },
  // Telangana / AP
  { value: "Hyderabad Deccan", label: "Hyderabad Deccan", sublabel: "HYB, Telangana" },
  { value: "Secunderabad Jn", label: "Secunderabad Jn", sublabel: "SC, Telangana" },
  { value: "Warangal", label: "Warangal", sublabel: "WL, Telangana" },
  { value: "Vijayawada Jn", label: "Vijayawada Jn", sublabel: "BZA, Andhra Pradesh" },
  { value: "Visakhapatnam Jn", label: "Visakhapatnam Jn", sublabel: "VSKP, Andhra Pradesh" },
  { value: "Tirupati", label: "Tirupati", sublabel: "TPTY, Andhra Pradesh" },
  // West Bengal / East
  { value: "Howrah Jn", label: "Howrah Jn", sublabel: "HWH, Kolkata" },
  { value: "Sealdah", label: "Sealdah", sublabel: "SDAH, Kolkata" },
  { value: "New Jalpaiguri", label: "New Jalpaiguri", sublabel: "NJP, West Bengal" },
  { value: "Bhubaneswar", label: "Bhubaneswar", sublabel: "BBS, Odisha" },
  { value: "Puri", label: "Puri", sublabel: "PURI, Odisha" },
  { value: "Ranchi Jn", label: "Ranchi Jn", sublabel: "RNC, Jharkhand" },
  { value: "Patna Jn", label: "Patna Jn", sublabel: "PNBE, Bihar" },
  { value: "Gaya Jn", label: "Gaya Jn", sublabel: "GAYA, Bihar" },
  { value: "Guwahati", label: "Guwahati", sublabel: "GHY, Assam" },
  // Gujarat
  { value: "Ahmedabad Jn", label: "Ahmedabad Jn", sublabel: "ADI, Gujarat" },
  { value: "Surat", label: "Surat", sublabel: "ST, Gujarat" },
  { value: "Vadodara Jn", label: "Vadodara Jn", sublabel: "BRC, Gujarat" },
  { value: "Rajkot Jn", label: "Rajkot Jn", sublabel: "RJT, Gujarat" },
  // Rajasthan
  { value: "Jaipur Jn", label: "Jaipur Jn", sublabel: "JP, Rajasthan" },
  { value: "Jodhpur Jn", label: "Jodhpur Jn", sublabel: "JU, Rajasthan" },
  { value: "Udaipur City", label: "Udaipur City", sublabel: "UDZ, Rajasthan" },
  { value: "Ajmer Jn", label: "Ajmer Jn", sublabel: "AII, Rajasthan" },
  { value: "Bikaner Jn", label: "Bikaner Jn", sublabel: "BKN, Rajasthan" },
  // Goa
  { value: "Goa Madgaon", label: "Goa Madgaon", sublabel: "MAO, Goa" },
  { value: "Vasco Da Gama", label: "Vasco Da Gama", sublabel: "VSG, Goa" },
  // Uttar Pradesh
  { value: "Lucknow Jn", label: "Lucknow Jn", sublabel: "LKO, Uttar Pradesh" },
  { value: "Kanpur Central", label: "Kanpur Central", sublabel: "CNB, Uttar Pradesh" },
  { value: "Prayagraj Jn", label: "Prayagraj Jn", sublabel: "PRYJ, Uttar Pradesh" },
  { value: "Varanasi Jn", label: "Varanasi Jn", sublabel: "BSB, Uttar Pradesh" },
  { value: "Gorakhpur Jn", label: "Gorakhpur Jn", sublabel: "GKP, Uttar Pradesh" },
  { value: "Agra Cantt", label: "Agra Cantt", sublabel: "AGC, Uttar Pradesh" },
  // Madhya Pradesh
  { value: "Bhopal Jn", label: "Bhopal Jn", sublabel: "BPL, Madhya Pradesh" },
  { value: "Indore Jn", label: "Indore Jn", sublabel: "INDB, Madhya Pradesh" },
  { value: "Gwalior Jn", label: "Gwalior Jn", sublabel: "GWL, Madhya Pradesh" },
  { value: "Jabalpur Jn", label: "Jabalpur Jn", sublabel: "JBP, Madhya Pradesh" },
  // Punjab / North
  { value: "Amritsar Jn", label: "Amritsar Jn", sublabel: "ASR, Punjab" },
  { value: "Ludhiana Jn", label: "Ludhiana Jn", sublabel: "LDH, Punjab" },
  { value: "Chandigarh Jn", label: "Chandigarh Jn", sublabel: "CDG, Chandigarh" },
  { value: "Jammu Tawi", label: "Jammu Tawi", sublabel: "JAT, Jammu & Kashmir" },
  { value: "Dehradun", label: "Dehradun", sublabel: "DDN, Uttarakhand" },
  { value: "Shimla", label: "Shimla", sublabel: "SML, Himachal Pradesh" },
  // Kerala
  { value: "Kochi Ernakulam Jn", label: "Kochi Ernakulam Jn", sublabel: "ERS, Kerala" },
  { value: "Thiruvananthapuram Central", label: "Thiruvananthapuram Central", sublabel: "TVC, Kerala" },
  { value: "Kozhikode", label: "Kozhikode", sublabel: "CLT, Kerala" },
  // Chhattisgarh / Jharkhand
  { value: "Raipur Jn", label: "Raipur Jn", sublabel: "R, Chhattisgarh" },
  { value: "Jamshedpur", label: "Jamshedpur", sublabel: "TATA, Jharkhand" },

  // International — cross-border and world rail hubs
  { value: "Dhaka Kamalapur (Maitree Express)", label: "Dhaka Kamalapur", sublabel: "Bangladesh — via Maitree Express" },
  { value: "Colombo Fort", label: "Colombo Fort", sublabel: "Sri Lanka" },
  { value: "Lahore Jn (Samjhauta Express)", label: "Lahore Jn", sublabel: "Pakistan — via Samjhauta Express" },
  { value: "London St Pancras", label: "London St Pancras", sublabel: "United Kingdom — Eurostar" },
  { value: "Paris Gare du Nord", label: "Paris Gare du Nord", sublabel: "France — Eurostar / TGV" },
  { value: "Amsterdam Centraal", label: "Amsterdam Centraal", sublabel: "Netherlands" },
  { value: "Brussels Midi", label: "Brussels Midi", sublabel: "Belgium" },
  { value: "Frankfurt Hbf", label: "Frankfurt Hbf", sublabel: "Germany — Deutsche Bahn ICE" },
  { value: "Berlin Hbf", label: "Berlin Hbf", sublabel: "Germany — Deutsche Bahn ICE" },
  { value: "Zurich HB", label: "Zurich HB", sublabel: "Switzerland" },
  { value: "Milan Centrale", label: "Milan Centrale", sublabel: "Italy — Frecciarossa" },
  { value: "Rome Termini", label: "Rome Termini", sublabel: "Italy — Frecciarossa" },
  { value: "Madrid Atocha", label: "Madrid Atocha", sublabel: "Spain — Renfe AVE" },
  { value: "Tokyo Station", label: "Tokyo Station", sublabel: "Japan — Shinkansen" },
  { value: "Osaka Station", label: "Osaka Station", sublabel: "Japan — Shinkansen" },
  { value: "Beijing South", label: "Beijing South", sublabel: "China — High-speed Rail" },
  { value: "New York Penn Station", label: "New York Penn Station", sublabel: "USA — Amtrak Acela" },
  { value: "Washington Union Station", label: "Washington Union Station", sublabel: "USA — Amtrak Acela" },
];

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

// Real-world-style operator pool for domestic (Indian Railways) routes
const DOMESTIC_TRAIN_BRANDS: { name: string; classes: string[] }[] = [
  { name: "Rajdhani Express", classes: ["3A", "2A", "1A"] },
  { name: "Duronto Express", classes: ["SL", "3A", "2A"] },
  { name: "Shatabdi Express", classes: ["CC", "EC"] },
  { name: "Garib Rath Express", classes: ["3A", "CC"] },
  { name: "Humsafar Express", classes: ["3A"] },
  { name: "Tejas Express", classes: ["CC", "EC"] },
  { name: "Vande Bharat Express", classes: ["CC", "EC"] },
  { name: "Sampark Kranti Express", classes: ["SL", "3A", "2A"] },
  { name: "Superfast Express", classes: ["SL", "3A", "2A", "2S"] },
  { name: "Intercity Express", classes: ["CC", "2S"] },
];

// International rail links reachable from this booking flow, keyed by matching keywords in the station name
function intlOperatorsFor(station: string): { name: string; classes: string[] }[] {
  if (/Dhaka/.test(station)) return [{ name: "Maitree Express", classes: ["AC Chair", "AC Cabin"] }];
  if (/Lahore/.test(station)) return [{ name: "Samjhauta Express", classes: ["AC Chair", "Sleeper"] }];
  if (/Colombo/.test(station)) return [{ name: "Indo-Lanka Intercity", classes: ["AC Chair", "First Class"] }];
  if (/London|Paris|Amsterdam|Brussels/.test(station)) return [
    { name: "Eurostar", classes: ["Standard", "Standard Premier", "Business Premier"] },
    { name: "TGV inOui", classes: ["Standard", "First Class"] },
  ];
  if (/Frankfurt|Berlin/.test(station)) return [{ name: "Deutsche Bahn ICE", classes: ["Standard", "First Class"] }];
  if (/Zurich/.test(station)) return [{ name: "Swiss Rail (SBB)", classes: ["Standard", "First Class"] }];
  if (/Milan|Rome/.test(station)) return [{ name: "Trenitalia Frecciarossa", classes: ["Standard", "Business", "Executive"] }];
  if (/Madrid/.test(station)) return [{ name: "Renfe AVE", classes: ["Turista", "Preferente"] }];
  if (/Tokyo|Osaka/.test(station)) return [{ name: "JR Shinkansen", classes: ["Ordinary", "Green Car"] }];
  if (/Beijing/.test(station)) return [{ name: "China Railway High-speed (CRH)", classes: ["Second Class", "First Class", "Business"] }];
  if (/New York|Washington/.test(station)) return [{ name: "Amtrak Acela", classes: ["Business", "First Class"] }];
  return [];
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const DEP_HOURS_TRAIN = ["04:45", "05:30", "06:15", "07:00", "08:20", "09:45", "11:10", "13:30", "15:35", "16:25", "17:00", "17:40", "19:15", "21:00", "22:30", "23:05", "23:59"];
const STATUS_POOL = ["AVL", "RAC", "WL"];

function generateTrains(origin: string, destination: string, count = 8): TrainResult[] {
  if (!origin || !destination) return [];
  const originIntl = intlOperatorsFor(origin);
  const destIntl = intlOperatorsFor(destination);
  const isInternational = originIntl.length > 0 || destIntl.length > 0;

  let pool: { name: string; classes: string[] }[];
  if (isInternational) {
    const seen = new Set<string>();
    pool = [...originIntl, ...destIntl].filter((o) => (seen.has(o.name) ? false : (seen.add(o.name), true)));
    if (!pool.length) pool = [{ name: "International Rail Link", classes: ["Standard", "First Class"] }];
  } else {
    pool = DOMESTIC_TRAIN_BRANDS;
  }

  const seed = hashCode(`${origin}-${destination}`);
  const n = Math.min(count, pool.length);
  const trains: TrainResult[] = [];

  for (let i = 0; i < n; i++) {
    const brand = pool[(seed + i) % pool.length];
    const dep = DEP_HOURS_TRAIN[(seed + i * 5) % DEP_HOURS_TRAIN.length];
    const durHours = isInternational ? 1 + ((seed + i * 3) % 8) : 4 + ((seed + i * 7) % 20);
    const durMin = ((seed + i * 11) % 4) * 15;
    const arrH = (parseInt(dep.slice(0, 2), 10) + durHours) % 24;
    const arrM = (parseInt(dep.slice(3, 5), 10) + durMin) % 60;

    const classes = brand.classes.map((code, ci) => {
      const isTopClass = ci === brand.classes.length - 1 && brand.classes.length > 1;
      const baseFare = isInternational
        ? 6000 + ci * 6000 + ((seed + i * 13) % 3000)
        : 350 + durHours * (30 + ci * 25) + ((seed + i * 9) % 400);
      const statusKind = STATUS_POOL[(seed + i * 3 + ci * 7) % STATUS_POOL.length];
      const statusNum = 2 + ((seed + i + ci) % 60);
      return { code, fare: Math.round(baseFare / 10) * 10, status: `${statusKind} ${statusNum}` };
    });

    trains.push({
      id: `tr-gen-${origin}-${destination}-${i}`,
      name: brand.name,
      number: isInternational ? `${brand.name.slice(0, 2).toUpperCase()}${100 + ((seed + i * 17) % 900)}` : `1${2000 + ((seed + i * 41) % 8000)}`,
      origin,
      destination,
      departTime: dep,
      arriveTime: `${String(arrH).padStart(2, "0")}:${String(arrM).padStart(2, "0")}`,
      duration: `${durHours}h ${durMin}m`,
      rating: Number((3.8 + ((seed + i) % 10) / 10).toFixed(1)),
      pantry: isInternational ? true : durHours >= 6,
      runningDays: Array.from({ length: 7 }, (_, d) => (seed + i * 3 + d) % 5 !== 0),
      classes,
    });
  }

  return trains.sort((a, b) => a.departTime.localeCompare(b.departTime));
}

function statusColor(status: string) {
  if (status.startsWith("AVL")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border-0";
  if (status.startsWith("RAC")) return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 border-0";
  if (status.startsWith("WL")) return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 border-0";
  return "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300 border-0";
}

interface Passenger {
  name: string; age: string; gender: "Male" | "Female" | "Other"; berth: string;
}

export function TrainView() {
  const { toast } = useToast();
  const addBooking = useDemoDataStore((s) => s.addBooking);
  const [fromStation, setFromStation] = useState("");
  const [toStation, setToStation] = useState("");
  const [date, setDate] = useState("2025-02-20");
  const [trainClass, setTrainClass] = useState("3A");
  const [searched, setSearched] = useState(false);

  const [bookingTrain, setBookingTrain] = useState<TrainResult | null>(null);
  const [bookingClassCode, setBookingClassCode] = useState<string>("");
  const [passengers, setPassengers] = useState<Passenger[]>([{ name: "", age: "", gender: "Male", berth: "No Preference" }]);
  const [payOpen, setPayOpen] = useState(false);
  const [pendingTrain, setPendingTrain] = useState<TrainResult | null>(null);
  const [pendingFare, setPendingFare] = useState(0);
  const [pendingPassengerName, setPendingPassengerName] = useState("");

  const handleSearch = () => {
    if (!fromStation || !toStation) {
      toast({ title: "Select stations", description: "Please choose both From and To stations.", variant: "destructive" });
      return;
    }
    if (fromStation === toStation) {
      toast({ title: "Invalid route", description: "From and To stations cannot be the same.", variant: "destructive" });
      return;
    }
    setSearched(true);
  };

  const filteredTrains = useMemo(
    () => generateTrains(fromStation, toStation, 8),
    [fromStation, toStation]
  );

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
    const fare = totalFare + 35 * passengers.length;
    setPendingTrain(bookingTrain);
    setPendingFare(fare);
    setPendingPassengerName(passengers[0]?.name || "Train Passenger");
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
            <CitySearchField
              icon={MapPin}
              label="From Station"
              placeholder="Search station..."
              value={fromStation}
              options={STATIONS}
              excludeValue={toStation}
              onSelect={setFromStation}
            />
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
            <CitySearchField
              icon={MapPin}
              label="To Station"
              placeholder="Search station..."
              value={toStation}
              options={STATIONS}
              excludeValue={fromStation}
              onSelect={setToStation}
            />
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
              <span className="font-semibold text-foreground">{filteredTrains.length}</span> train{filteredTrains.length === 1 ? "" : "s"} found from <span className="font-medium">{fromStation}</span> to <span className="font-medium">{toStation}</span>
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
        amount={pendingFare}
        title={pendingTrain ? `${pendingTrain.name} • ${passengers.length} passenger(s)` : "Train Booking"}
        description={pendingTrain ? `${pendingTrain.name} (${pendingTrain.number}) • ${pendingTrain.origin} → ${pendingTrain.destination}` : "Train Booking"}
        shareSubject={pendingTrain ? `Your Train Ticket — ${pendingTrain.name}` : "Train Ticket"}
        shareText={pendingTrain ? `Train Ticket Confirmed\n${pendingTrain.name} (${pendingTrain.number})\n${pendingTrain.origin} → ${pendingTrain.destination}\nDate: ${date}\nPassenger: ${pendingPassengerName}\nAmount Paid: ${formatFullINR(pendingFare)}` : ""}
        onClose={() => {
          setPayOpen(false);
          setPassengers([{ name: "", age: "", gender: "Male", berth: "No Preference" }]);
          setPendingTrain(null);
          setPendingFare(0);
          setPendingPassengerName("");
        }}
        onSuccess={(method: BookingPaymentMethod) => {
          if (pendingTrain) {
            addBooking({
              customerName: pendingPassengerName,
              service: "Train",
              route: `${pendingTrain.origin} → ${pendingTrain.destination}`,
              travelDate: date,
              amount: pendingFare,
              paymentMethod: method,
            });
          }
        }}
      />
    </div>
  );
}
