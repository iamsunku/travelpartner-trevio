"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plane, Hotel, Bus, Palmtree, Shield, ArrowRight, Mail, Lock, Phone,
  KeyRound, Building2, UserCog, User, Eye, EyeOff, CheckCircle2, Sparkles,
  Globe, TrendingUp, Users2,
} from "lucide-react";
import { useAuthStore } from "@/store/app-store";
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/nav-config";
import type { Role } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Mode = "login" | "otp" | "forgot" | "2fa";

const ROLE_CARDS: { role: Role; icon: React.ElementType; gradient: string }[] = [
  { role: "super_admin", icon: Shield, gradient: "from-violet-500 to-purple-600" },
  { role: "agency_admin", icon: Building2, gradient: "from-teal-500 to-emerald-600" },
  { role: "branch_manager", icon: UserCog, gradient: "from-amber-500 to-orange-600" },
  { role: "employee", icon: User, gradient: "from-rose-500 to-pink-600" },
  { role: "accountant", icon: TrendingUp, gradient: "from-cyan-500 to-teal-600" },
  { role: "customer", icon: Users2, gradient: "from-orange-500 to-red-600" },
];

const HIGHLIGHTS = [
  { icon: Plane, label: "1M+ Flights Booked" },
  { icon: Hotel, label: "50K+ Hotels" },
  { icon: Bus, label: "Real-time Inventory" },
  { icon: Palmtree, label: "Custom Holiday Packages" },
];

export function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<Role>("agency_admin");
  const [mode, setMode] = useState<Mode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (mode === "2fa" || selectedRole === "super_admin" || selectedRole === "agency_admin") {
        setMode("2fa");
        toast({ title: "2FA Code Sent", description: "Enter the 6-digit code from your authenticator app" });
      } else {
        completeLogin();
      }
    }, 700);
  };

  const handleOtpVerify = () => {
    setLoading(true);
    setTimeout(() => completeLogin(), 600);
  };

  const completeLogin = () => {
    setLoading(false);
    toast({
      title: `Welcome back!`,
      description: `Signed in as ${ROLE_LABELS[selectedRole]}`,
    });
    login(selectedRole);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left hero panel */}
      <div className="lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 text-white p-8 lg:p-12 flex flex-col justify-between">
        <div className="absolute inset-0 hero-pattern opacity-40" />
        <div className="absolute top-20 -right-20 w-72 h-72 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="absolute bottom-10 -left-10 w-80 h-80 rounded-full bg-emerald-400/20 blur-3xl" />

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
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Travel Partner Pro</h1>
              <p className="text-xs text-teal-100">Enterprise Travel SaaS Platform</p>
            </div>
          </div>
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
              Flights, hotels, buses, holidays, visa & insurance — with multi-agency RBAC,
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
                <h.icon className="w-4 h-4 text-amber-300 shrink-0" />
                <span className="text-sm font-medium">{h.label}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6 text-sm text-teal-100">
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
                          onClick={() => setSelectedRole(rc.role)}
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
                      <Label className="text-xs">Email or Agency Code</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          className="pl-9 h-11"
                          defaultValue={
                            selectedRole === "super_admin" ? "superadmin@travelpartner.pro" :
                            selectedRole === "customer" ? "karthik.v@gmail.com" :
                            "admin@wanderlusttravels.in"
                          }
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
                          defaultValue="demo1234"
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

              {mode === "2fa" && (
                <div className="space-y-6">
                  <div>
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                      <KeyRound className="w-7 h-7 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold">Two-Factor Authentication</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Enter the 6-digit code from your authenticator app to continue.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-center block">Authentication Code</Label>
                    <div className="flex justify-center">
                      <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                        <InputOTPGroup>
                          {[0, 1, 2, 3, 4, 5].map((i) => (
                            <InputOTPSlot key={i} index={i} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    <p className="text-xs text-center text-muted-foreground">Demo code: 123456</p>
                  </div>
                  <Button onClick={handleOtpVerify} disabled={otp.length < 6 || loading} className="w-full h-11">
                    {loading ? "Verifying..." : "Verify & Continue"}
                  </Button>
                  <button onClick={() => setMode("login")} className="text-sm text-muted-foreground hover:text-foreground w-full text-center">
                    Use a different method
                  </button>
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
                      Enter your email and we'll send you a reset link.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input className="pl-9 h-11" placeholder="you@agency.com" />
                    </div>
                  </div>
                  <Button onClick={() => { toast({ title: "Reset link sent", description: "Check your inbox" }); setMode("login"); }} className="w-full h-11">
                    Send Reset Link
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
