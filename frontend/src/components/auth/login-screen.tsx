"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plane, Hotel, Zap, Palmtree, Shield, ArrowRight, Mail, Lock, Phone,
  Building2, UserCog, User, Eye, EyeOff, CheckCircle2, Sparkles,
  Globe, TrendingUp,
} from "lucide-react";
import { useAuthStore } from "@/store/app-store";
import { useDemoDataStore } from "@/store/demo-data-store";
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/nav-config";
import { ROLE_USERS } from "@/lib/mock-data";
import { api } from "@/lib/api";
import type { Role } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const DEMO_PASSWORD = "Passw0rd@123";

type Mode = "login" | "otp" | "forgot";

const ROLE_CARDS: { role: Role; icon: React.ElementType; gradient: string }[] = [
  { role: "super_admin", icon: Shield, gradient: "from-blue-600 to-indigo-700" },
  { role: "agency_admin", icon: Building2, gradient: "from-blue-500 to-teal-500" },
  { role: "branch_manager", icon: UserCog, gradient: "from-teal-500 to-cyan-600" },
  { role: "employee", icon: User, gradient: "from-sky-500 to-blue-600" },
  { role: "accountant", icon: TrendingUp, gradient: "from-teal-600 to-emerald-600" },
];

const HIGHLIGHTS = [
  { icon: Plane, label: "1M+ Flights Booked" },
  { icon: Hotel, label: "50K+ Hotels" },
  { icon: Zap, label: "Real-time Inventory" },
  { icon: Palmtree, label: "Custom Holiday Packages" },
];

export function LoginScreen() {
  const loginWithApi = useAuthStore((s) => s.loginWithApi);
  const hydrateFromApi = useDemoDataStore((s) => s.hydrateFromApi);
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<Role>("agency_admin");
  const [mode, setMode] = useState<Mode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState(ROLE_USERS.agency_admin.email);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const selectRole = (role: Role) => {
    setSelectedRole(role);
    setEmail(ROLE_USERS[role].email);
    setPassword(DEMO_PASSWORD);
  };

  const handleLogin = async () => {
    setLoading(true);
    const result = await loginWithApi(email, password);
    setLoading(false);
    if (!result.ok) {
      toast({ title: "Sign in failed", description: result.error || "Invalid email or password", variant: "destructive" });
      return;
    }
    const user = useAuthStore.getState().user;
    await hydrateFromApi(user?.agencyId);
    toast({ title: "Welcome back!", description: `Signed in as ${user ? ROLE_LABELS[user.role] : ""}` });
  };

  const handleOtpVerify = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast({ title: "OTP login is a demo-only flow", description: "Please sign in with email and password instead." });
      setMode("login");
    }, 600);
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      toast({ title: "Enter your email", variant: "destructive" });
      return;
    }
    setForgotLoading(true);
    try {
      const res = await api.forgotPassword(forgotEmail.trim());
      if (res.tempPassword) {
        toast({
          title: "Password reset",
          description: `This demo has no email delivery — your new temporary password is: ${res.tempPassword} (copy it now, it won't be shown again).`,
        });
      } else {
        toast({ title: "Check that email", description: "If an account exists for that address, it has been reset." });
      }
      setMode("login");
      setForgotEmail("");
    } catch {
      toast({ title: "Couldn't reset password", description: "Please try again.", variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left hero panel */}
      <div className="lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-brand-blue via-primary to-brand-teal text-white p-8 lg:p-12 flex flex-col justify-between">
        <div className="absolute inset-0 hero-pattern opacity-40" />
        <div className="absolute top-20 -right-20 w-72 h-72 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute bottom-10 -left-10 w-80 h-80 rounded-full bg-brand-teal/30 blur-3xl" />

        {/* Floating plane animation */}
        <motion.div
          className="absolute top-1/3 right-12 opacity-20"
          animate={{ x: [0, 30, 0], y: [0, -20, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        >
          <Plane className="w-40 h-40" />
        </motion.div>

        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-2">
            <img
              src="/trevio-logo.png"
              alt="Trevio Global"
              className="h-10 w-auto drop-shadow-md"
            />
          </div>
          <p className="text-xs text-white/70 mt-1">Enterprise Travel SaaS Platform</p>
        </div>

        <div className="relative z-10 space-y-6 max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-medium mb-4">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              All-in-one travel booking solution
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold leading-tight mb-4">
              Book the world,<br />run your agency.
            </h2>
            <p className="text-teal-100 text-base leading-relaxed">
              Flights, hotels, and holidays — with multi-agency RBAC,
              CRM, payments, and commission engine. Everything in one powerful dashboard.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 gap-3">
            {HIGHLIGHTS.map((h, i) => (
              <motion.div
                key={h.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15"
              >
                <h.icon className="w-4 h-4 text-white shrink-0" />
                <span className="text-sm font-medium">{h.label}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6 text-sm text-white/80">
          <div>
            <div className="text-2xl font-bold text-white">6</div>
            <div className="text-xs">Role Types</div>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div>
            <div className="text-2xl font-bold text-white">28+</div>
            <div className="text-xs">Modules</div>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div>
            <div className="text-2xl font-bold text-white">99.9%</div>
            <div className="text-xs">Uptime</div>
          </div>
        </div>
      </div>

      {/* Right login panel */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {mode === "login" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold">Sign in to your account</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Select your role to continue. Each role has a tailored experience.
                    </p>
                  </div>

                  {/* Role selector */}
                  <div className="grid grid-cols-3 gap-2">
                    {ROLE_CARDS.map((rc) => {
                      const active = selectedRole === rc.role;
                      return (
                        <button
                          key={rc.role}
                          onClick={() => selectRole(rc.role)}
                          className={cn(
                            "relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                            active
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border hover:border-primary/40 hover:bg-muted/50"
                          )}
                        >
                          <div className={cn("w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center text-white", rc.gradient)}>
                            <rc.icon className="w-4.5 h-4.5" />
                          </div>
                          <span className="text-[11px] font-medium text-center leading-tight">
                            {ROLE_LABELS[rc.role].split(" ")[0]}
                          </span>
                          {active && (
                            <CheckCircle2 className="absolute -top-1.5 -right-1.5 w-4 h-4 text-primary bg-background rounded-full" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-3 rounded-lg bg-muted/60 border border-border">
                    <p className="text-xs font-medium">{ROLE_LABELS[selectedRole]}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{ROLE_DESCRIPTIONS[selectedRole]}</p>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          className="pl-9 h-11"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@agency.com"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Password</Label>
                        <button onClick={() => setMode("forgot")} className="text-xs text-primary hover:underline">
                          Forgot?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          className="pl-9 pr-9 h-11"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full h-11 text-sm font-semibold"
                    size="lg"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Signing in...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        Sign in as {ROLE_LABELS[selectedRole]}
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    )}
                  </Button>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">or</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => setMode("otp")}
                    className="w-full h-11"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Login with OTP
                  </Button>
                </div>
              )}

              {mode === "otp" && (
                <div className="space-y-6">
                  <button onClick={() => setMode("login")} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                    ← Back to login
                  </button>
                  <div>
                    <h2 className="text-2xl font-bold">OTP Login</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Enter your registered mobile number to receive a one-time password.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mobile Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input className="pl-9 h-11" defaultValue="+91 98200 12345" />
                    </div>
                  </div>
                  <Button onClick={() => { setOtp(""); toast({ title: "OTP Sent", description: "Use 123456 for demo" }); }} className="w-full h-11">
                    Send OTP
                  </Button>
                  <div className="space-y-2">
                    <Label className="text-center block">Enter 6-digit OTP</Label>
                    <div className="flex justify-center">
                      <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                        <InputOTPGroup>
                          {[0, 1, 2, 3, 4, 5].map((i) => (
                            <InputOTPSlot key={i} index={i} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    <p className="text-xs text-center text-muted-foreground">Demo OTP: 123456</p>
                  </div>
                  <Button onClick={handleOtpVerify} disabled={otp.length < 6 || loading} className="w-full h-11">
                    {loading ? "Verifying..." : "Verify & Login"}
                  </Button>
                </div>
              )}

              {mode === "forgot" && (
                <div className="space-y-6">
                  <button onClick={() => setMode("login")} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                    ← Back to login
                  </button>
                  <div>
                    <h2 className="text-2xl font-bold">Reset Password</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Enter your email — since this demo has no email delivery, we'll hand you a new temporary password directly.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        className="pl-9 h-11"
                        placeholder="you@agency.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleForgotPassword()}
                      />
                    </div>
                  </div>
                  <Button onClick={handleForgotPassword} disabled={forgotLoading} className="w-full h-11">
                    {forgotLoading ? "Resetting..." : "Reset Password"}
                  </Button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <p className="text-xs text-center text-muted-foreground mt-8">
            Demo platform · Select any role to explore · No real credentials needed
          </p>
        </div>
      </div>
    </div>
  );
}
