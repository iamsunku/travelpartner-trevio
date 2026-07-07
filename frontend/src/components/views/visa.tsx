"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Plane, FileText, Building2, Upload, CheckCircle2, Clock,
  Globe2, User, MapPin,
  IdCard, Image as ImageIcon, ReceiptText,
  ShieldCheck, FileCheck2, AlertCircle, Phone as PhoneIcon,
  Briefcase, GraduationCap,
} from "lucide-react";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useDemoDataStore } from "@/store/demo-data-store";
import { PageHeader, StatusBadge } from "@/components/shared/ui-helpers";
import { cn } from "@/lib/utils";

const COUNTRIES = [
  "United States", "United Kingdom", "Schengen (Multi)", "Canada", "Australia",
  "Singapore", "UAE", "Thailand", "Japan", "Malaysia", "Indonesia", "Switzerland",
];

const VISA_TYPES = [
  { id: "Tourist", label: "Tourist Visa", icon: Plane, desc: "Sightseeing, family visits, leisure travel" },
  { id: "Business", label: "Business Visa", icon: Briefcase, desc: "Meetings, conferences, business dealings" },
  { id: "Student", label: "Student Visa", icon: GraduationCap, desc: "Study at foreign universities & institutions" },
  { id: "Work", label: "Work Visa", icon: Building2, desc: "Employment and work permits" },
];

const DOCUMENTS = [
  { id: "passport", label: "Passport", desc: "First & last page (PDF/JPG, max 5MB)", icon: IdCard, required: true },
  { id: "photo", label: "Passport Photo", desc: "White background, 2x2 inch (JPG)", icon: ImageIcon, required: true },
  { id: "bank", label: "Bank Statement", desc: "Last 6 months (PDF, max 5MB)", icon: ReceiptText, required: true },
  { id: "it", label: "IT Returns", desc: "Last 2 years (PDF)", icon: FileText, required: false },
];

interface VisaApp {
  id: string;
  country: string;
  type: string;
  applicant: string;
  submittedDate: string;
  appointmentDate: string;
  status: "Submitted" | "Under Review" | "Approved" | "Rejected";
  passport: string;
}

const MOCK_APPLICATIONS: VisaApp[] = [
  { id: "VS-2025-0148", country: "Schengen (Multi)", type: "Tourist", applicant: "Karthik Venkat", submittedDate: "2025-01-08", appointmentDate: "2025-01-25", status: "Approved", passport: "P8394721" },
  { id: "VS-2025-0152", country: "United States", type: "Business", applicant: "Rohit Gupta", submittedDate: "2025-01-12", appointmentDate: "2025-02-04", status: "Under Review", passport: "T5629104" },
  { id: "VS-2025-0161", country: "UAE", type: "Tourist", applicant: "Anjali Desai", submittedDate: "2025-01-15", appointmentDate: "2025-01-22", status: "Submitted", passport: "R2289104" },
  { id: "VS-2025-0144", country: "United Kingdom", type: "Student", applicant: "Imran Khan", submittedDate: "2025-01-03", appointmentDate: "2025-01-12", status: "Rejected", passport: "K9910234" },
  { id: "VS-2025-0158", country: "Singapore", type: "Work", applicant: "Suresh Pillai", submittedDate: "2025-01-14", appointmentDate: "2025-01-30", status: "Approved", passport: "L7720394" },
];

interface Embassy {
  country: string; flag: string; city: string; address: string; phone: string; hours: string;
}

const EMBASSIES: Embassy[] = [
  { country: "United States", flag: "🇺🇸", city: "New Delhi", address: "Shantipath, Chanakyapuri, New Delhi 110021", phone: "+91 11 2419 8000", hours: "Mon–Fri, 9:00 AM – 5:30 PM" },
  { country: "United Kingdom", flag: "🇬🇧", city: "New Delhi", address: "Shantipath, Chanakyapuri, New Delhi 110021", phone: "+91 11 2419 2100", hours: "Mon–Fri, 8:30 AM – 5:00 PM" },
  { country: "Schengen (Germany)", flag: "🇩🇪", city: "Mumbai", address: "Hoechst House, 193 Backbay Reclamation, Nariman Point, Mumbai 400021", phone: "+91 22 2283 2422", hours: "Mon–Fri, 9:00 AM – 12:00 PM" },
  { country: "Australia", flag: "🇦🇺", city: "Mumbai", address: "Level 6, Tower 2, World Trade Centre, Cuffe Parade, Mumbai 400005", phone: "+91 22 6146 1500", hours: "Mon–Fri, 8:30 AM – 4:30 PM" },
  { country: "UAE", flag: "🇦🇪", city: "Mumbai", address: "Maker Chambers IV, 5th Floor, Nariman Point, Mumbai 400021", phone: "+91 22 2289 1600", hours: "Sun–Thu, 9:00 AM – 3:00 PM" },
];

export function VisaView() {
  const { toast } = useToast();
  const visaApplications = useDemoDataStore((s) => s.visaApplications);
  const addVisaApplication = useDemoDataStore((s) => s.addVisaApplication);
  const [tab, setTab] = useState("apply");

  // form state
  const [country, setCountry] = useState("");
  const [visaType, setVisaType] = useState("");
  const [applicantName, setApplicantName] = useState("");
  const [passportNo, setPassportNo] = useState("");
  const [nationality, setNationality] = useState("Indian");
  const [dob, setDob] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [uploads, setUploads] = useState<Record<string, boolean>>({});

  const handleUpload = (docId: string) => {
    setUploads((p) => ({ ...p, [docId]: true }));
    toast({ title: "Document uploaded", description: `${DOCUMENTS.find((d) => d.id === docId)?.label} attached successfully.` });
  };

  const handleSubmit = () => {
    if (!country || !visaType || !applicantName.trim() || !passportNo.trim() || !dob || !travelDate) {
      toast({ title: "Incomplete form", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    const requiredDocs = DOCUMENTS.filter((d) => d.required);
    if (requiredDocs.some((d) => !uploads[d.id])) {
      toast({ title: "Documents missing", description: "Please upload all required documents.", variant: "destructive" });
      return;
    }
    const app = addVisaApplication({
      country,
      type: visaType,
      applicant: applicantName,
      passport: passportNo,
    });
    toast({
      title: "Application Submitted!",
      description: `Visa application for ${country} (${visaType}) received. Application ID: ${app.id}`,
    });
    // reset form
    setCountry(""); setVisaType(""); setApplicantName(""); setPassportNo("");
    setDob(""); setTravelDate(""); setUploads({});
    setTab("applications");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Visa Services"
        subtitle="Apply for tourist, business, student & work visas. Track applications and view embassy details."
        action={
          <Button onClick={() => setTab("apply")} className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700">
            <Plane className="w-4 h-4" /> New Application
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full md:w-auto grid-cols-3">
          <TabsTrigger value="apply"><FileText className="w-4 h-4 mr-1.5" /> Apply Visa</TabsTrigger>
          <TabsTrigger value="applications"><Clock className="w-4 h-4 mr-1.5" /> My Applications</TabsTrigger>
          <TabsTrigger value="embassy"><Building2 className="w-4 h-4 mr-1.5" /> Embassy Details</TabsTrigger>
        </TabsList>

        {/* Apply Visa */}
        <TabsContent value="apply" className="space-y-4 mt-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: form */}
            <div className="lg:col-span-2 space-y-4">
              {/* Section 1: Country & visa type */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center">1</span>
                    Destination & Visa Type
                  </CardTitle>
                  <CardDescription className="text-xs">Select where you're travelling and the purpose of visit.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Country <span className="text-rose-500">*</span></Label>
                    <Select value={country} onValueChange={setCountry}>
                      <SelectTrigger className="mt-1 w-full"><Globe2 className="w-4 h-4 mr-1 text-violet-600" /><SelectValue placeholder="Select country" /></SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Visa Type <span className="text-rose-500">*</span></Label>
                    <Select value={visaType} onValueChange={setVisaType}>
                      <SelectTrigger className="mt-1 w-full"><FileText className="w-4 h-4 mr-1 text-violet-600" /><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        {VISA_TYPES.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {visaType && (
                    <div className="md:col-span-2">
                      {VISA_TYPES.filter((v) => v.id === visaType).map((v) => {
                        const Icon = v.icon;
                        return (
                          <Alert key={v.id} className="bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800">
                            <Icon className="w-4 h-4 text-violet-600" />
                            <AlertDescription className="text-xs text-violet-700 dark:text-violet-300">
                              <span className="font-semibold">{v.label}:</span> {v.desc}
                            </AlertDescription>
                          </Alert>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Section 2: Applicant details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center">2</span>
                    Applicant Details
                  </CardTitle>
                  <CardDescription className="text-xs">Provide personal information as per your passport.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <Label className="text-xs">Full Name <span className="text-rose-500">*</span></Label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input value={applicantName} onChange={(e) => setApplicantName(e.target.value)} placeholder="As per passport" className="pl-9 mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Passport Number <span className="text-rose-500">*</span></Label>
                    <div className="relative">
                      <IdCard className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input value={passportNo} onChange={(e) => setPassportNo(e.target.value.toUpperCase())} placeholder="A1234567" className="pl-9 mt-1 uppercase" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Nationality <span className="text-rose-500">*</span></Label>
                    <Select value={nationality} onValueChange={setNationality}>
                      <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Indian", "NRI", "Other"].map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Date of Birth <span className="text-rose-500">*</span></Label>
                    <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Travel Date <span className="text-rose-500">*</span></Label>
                    <Input type="date" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} className="mt-1" />
                  </div>
                </CardContent>
              </Card>

              {/* Section 3: Documents */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center">3</span>
                    Document Upload
                  </CardTitle>
                  <CardDescription className="text-xs">Upload clear scans of required documents.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {DOCUMENTS.map((doc) => {
                    const Icon = doc.icon;
                    const uploaded = uploads[doc.id];
                    return (
                      <div
                        key={doc.id}
                        className={cn(
                          "relative rounded-lg border-2 border-dashed p-3 transition-all",
                          uploaded ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-border hover:border-violet-400 hover:bg-violet-50/30 dark:hover:bg-violet-950/10"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", uploaded ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600" : "bg-violet-100 dark:bg-violet-900/40 text-violet-600")}>
                            {uploaded ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold">{doc.label}</p>
                              {doc.required && <span className="text-[10px] text-rose-500 font-medium">REQUIRED</span>}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{doc.desc}</p>
                            {uploaded ? (
                              <p className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
                                <FileCheck2 className="w-3 h-3" /> Uploaded • ready
                              </p>
                            ) : (
                              <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => handleUpload(doc.id)}>
                                <Upload className="w-3 h-3" /> Upload
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Button
                onClick={handleSubmit}
                size="lg"
                className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
              >
                <ShieldCheck className="w-4 h-4" /> Submit Application
              </Button>
            </div>

            {/* Right: summary panel */}
            <div>
              <Card className="sticky top-4 overflow-hidden">
                <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-700 p-4 text-white">
                  <IdCard className="w-8 h-8 mb-2 opacity-80" />
                  <h3 className="font-bold text-lg">Visa Summary</h3>
                  <p className="text-xs text-white/80 mt-0.5">Review before submitting</p>
                </div>
                <CardContent className="p-4 space-y-2 text-sm">
                  <SummaryRow label="Country" value={country || "—"} />
                  <SummaryRow label="Visa Type" value={visaType ? VISA_TYPES.find((v) => v.id === visaType)?.label || "—" : "—"} />
                  <SummaryRow label="Applicant" value={applicantName || "—"} />
                  <SummaryRow label="Passport No." value={passportNo || "—"} />
                  <SummaryRow label="Nationality" value={nationality} />
                  <SummaryRow label="Travel Date" value={travelDate || "—"} />
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Documents Uploaded</span>
                    <span className="text-xs font-semibold">{Object.values(uploads).filter(Boolean).length}/{DOCUMENTS.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Processing Time</span>
                    <span className="text-xs font-semibold">7–10 business days</span>
                  </div>
                  <Alert className="mt-3 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
                      Visa fee: <span className="font-semibold">₹8,500</span> (non-refundable). Payable at embassy appointment.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </TabsContent>

        {/* My Applications */}
        <TabsContent value="applications" className="mt-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-violet-600" /> My Visa Applications
                </CardTitle>
                <CardDescription>Track the status of all your submitted visa applications.</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Desktop table */}
                <div className="hidden md:block rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-muted-foreground">
                        <th className="text-left font-medium px-3 py-2">App ID</th>
                        <th className="text-left font-medium px-3 py-2">Country</th>
                        <th className="text-left font-medium px-3 py-2">Type</th>
                        <th className="text-left font-medium px-3 py-2">Applicant</th>
                        <th className="text-left font-medium px-3 py-2">Submitted</th>
                        <th className="text-left font-medium px-3 py-2">Appointment</th>
                        <th className="text-left font-medium px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visaApplications.map((app) => (
                        <tr key={app.id} className="border-t hover:bg-muted/30">
                          <td className="px-3 py-3 font-mono text-xs font-semibold text-violet-700 dark:text-violet-300">{app.id}</td>
                          <td className="px-3 py-3">{app.country}</td>
                          <td className="px-3 py-3"><Badge variant="outline" className="text-[10px]">{app.type}</Badge></td>
                          <td className="px-3 py-3">{app.applicant}</td>
                          <td className="px-3 py-3 text-muted-foreground text-xs">{app.submittedDate}</td>
                          <td className="px-3 py-3 text-muted-foreground text-xs">{app.appointmentDate}</td>
                          <td className="px-3 py-3"><StatusBadge status={app.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {visaApplications.map((app) => (
                    <div key={app.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-xs font-semibold text-violet-700 dark:text-violet-300">{app.id}</p>
                          <p className="font-semibold text-sm mt-0.5">{app.country}</p>
                          <p className="text-xs text-muted-foreground">{app.applicant} • {app.type}</p>
                        </div>
                        <StatusBadge status={app.status} />
                      </div>
                      <Separator className="my-2" />
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <div><span className="text-muted-foreground">Submitted:</span> {app.submittedDate}</div>
                        <div><span className="text-muted-foreground">Appointment:</span> {app.appointmentDate}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Embassy Details */}
        <TabsContent value="embassy" className="mt-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {EMBASSIES.map((e) => (
              <Card key={e.country} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{e.flag}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base">{e.country} Embassy</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-violet-600" /> {e.city}
                      </p>
                      <Separator className="my-2" />
                      <div className="space-y-1.5 text-xs">
                        <p className="flex items-start gap-2 text-muted-foreground">
                          <Building2 className="w-3.5 h-3.5 mt-0.5 text-slate-500 shrink-0" />
                          <span>{e.address}</span>
                        </p>
                        <p className="flex items-center gap-2 text-muted-foreground">
                          <PhoneIcon className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{e.phone}</span>
                        </p>
                        <p className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>{e.hours}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}
