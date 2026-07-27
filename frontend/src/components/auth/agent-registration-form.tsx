"use client";

import { useMemo, useRef, useState } from "react";
import { Upload, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/app-store";
import { useDemoDataStore } from "@/store/demo-data-store";
import { mapApiUser } from "@/lib/api-mappers";
import { COUNTRY_CODES, COUNTRIES, CITIES_BY_COUNTRY, INDIAN_STATES } from "@/lib/location-options";
import { cn } from "@/lib/utils";

const MAX_PROOF_BYTES = 5 * 1024 * 1024;

export function AgentRegistrationForm({
  onLogin,
}: {
  onLogin: () => void;
}) {
  const { toast } = useToast();
  const hydrateFromApi = useDemoDataStore((s) => s.hydrateFromApi);
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [gstProofName, setGstProofName] = useState("");
  const [gstProofUrl, setGstProofUrl] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const cityOptions = useMemo(() => {
    if (!country) return [];
    return CITIES_BY_COUNTRY[country] || [];
  }, [country]);

  const stateOptions = country === "India" ? INDIAN_STATES : [];

  async function handleProofFile(file: File) {
    if (file.size > MAX_PROOF_BYTES) {
      toast({ title: "File too large", description: "GST proof must be under 5MB.", variant: "destructive" });
      return;
    }
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Invalid file", description: "Upload JPG, PNG, or PDF only.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setGstProofUrl(String(reader.result || ""));
      setGstProofName(file.name);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!termsAccepted) {
      toast({ title: "Accept terms", description: "Please agree to the Terms & Conditions.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { user, token } = await api.registerAgent({
        fullName: fullName.trim(),
        companyName: companyName.trim(),
        address: address.trim(),
        email: email.trim(),
        countryCode,
        phone: phone.trim(),
        country,
        state,
        city,
        panNumber: panNumber.trim() || undefined,
        password,
        confirmPassword,
        gstNumber: gstNumber.trim() || undefined,
        gstProofUrl: gstProofUrl || undefined,
        termsAccepted: true,
      });

      useAuthStore.setState({
        user: mapApiUser(user),
        token,
        isAuthenticated: true,
        apiConnected: true,
      });
      await hydrateFromApi(user.agencyId ?? undefined);
      toast({
        title: "Welcome to Trevio Global!",
        description: "Your agent account has been created. You're now signed in.",
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Registration failed. Please try again.";
      toast({ title: "Registration failed", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6f9] overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-border text-xs font-semibold tracking-wide text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            NEW AGENT REGISTRATION
          </div>
          <Button onClick={onLogin} className="bg-[#1e2a5a] hover:bg-[#162044] text-white px-6">
            Login
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#1e2a5a] leading-tight">
            Create Your <span className="text-amber-500">Agent Account!</span>
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Fill in your details below to register with Trevio Global and access the agent portal.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-border shadow-sm p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name" required>
              <Input placeholder="Enter full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </Field>
            <Field label="Company Name" required>
              <Input placeholder="Enter company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
            </Field>
          </div>

          <Field label="Address" required>
            <Textarea placeholder="Enter business address" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} required />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Email Address" required>
              <Input type="email" placeholder="you@agency.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Mobile Number" required>
              <div className="flex gap-2">
                <Select value={countryCode} onValueChange={setCountryCode}>
                  <SelectTrigger className="w-[110px] shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRY_CODES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="flex-1"
                  placeholder="Enter mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
                  required
                />
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Country" required>
              <Select value={country} onValueChange={(v) => { setCountry(v); setState(""); setCity(""); }}>
                <SelectTrigger><SelectValue placeholder="Select Country" /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="State/Province" required>
              {stateOptions.length > 0 ? (
                <Select value={state} onValueChange={(v) => { setState(v); setCity(""); }}>
                  <SelectTrigger><SelectValue placeholder="State/Province" /></SelectTrigger>
                  <SelectContent>
                    {stateOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input placeholder="State/Province" value={state} onChange={(e) => setState(e.target.value)} required />
              )}
            </Field>
            <Field label="City" required>
              {cityOptions.length > 0 ? (
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger><SelectValue placeholder="Search to select city" /></SelectTrigger>
                  <SelectContent>
                    {cityOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input placeholder="Enter city" value={city} onChange={(e) => setCity(e.target.value)} required />
              )}
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="PAN / Tax No.">
              <Input placeholder="PAN / Tax No." value={panNumber} onChange={(e) => setPanNumber(e.target.value)} />
            </Field>
            <Field label="Password" required>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Min 12 chars, upper, lower, number & special character</p>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Confirm Password" required>
              <div className="relative">
                <Input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
            <Field label="GST / VAT No.">
              <Input placeholder="GST / VAT No." value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} />
            </Field>
          </div>

          <Field label="GST / VAT Proof">
            <input
              ref={fileRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleProofFile(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={cn(
                "w-full rounded-xl border-2 border-dashed border-border p-8 text-center transition hover:border-primary/40 hover:bg-muted/30",
                gstProofName && "border-emerald-300 bg-emerald-50/50",
              )}
            >
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">
                {gstProofName ? gstProofName : "Click to upload GST / VAT Proof"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG or PDF · Max 5MB</p>
            </button>
          </Field>

          <div className="flex items-start gap-3 pt-2">
            <Checkbox
              id="terms"
              checked={termsAccepted}
              onCheckedChange={(v) => setTermsAccepted(v === true)}
            />
            <label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
              I agree to the <span className="font-semibold text-foreground">Terms & Conditions</span> and confirm that the provided business details are correct.
            </label>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 text-base font-semibold bg-[#1e2a5a] hover:bg-[#162044]"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating account...
              </span>
            ) : (
              "Create Agent Account"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label, required, children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-[#1e2a5a]">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}
