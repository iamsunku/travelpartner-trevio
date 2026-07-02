"use client";

import { useState } from "react";
import {
  Building2, Users, Cog, Shield, Camera, Save, Plus, KeyRound, Globe,
  Clock, Lock, Smartphone, Mail, MessageSquare, Phone, Wifi, Server,
  CheckCircle2, AlertTriangle, Pencil, Check, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/ui-helpers";
import { cn } from "@/lib/utils";

const ROLES = [
  { role: "Super Admin", users: 1, color: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400" },
  { role: "Agency Admin", users: 1, color: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400" },
  { role: "Branch Manager", users: 2, color: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" },
  { role: "Employee", users: 5, color: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400" },
  { role: "Accountant", users: 1, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
];

const MODULES = ["Bookings", "Customers", "Payments", "Reports", "Employees", "Quotations", "Visa", "API Marketplace", "Settings"];
const ACTIONS = ["view", "edit", "delete", "approve"] as const;
type Action = typeof ACTIONS[number];

// Initialize a default permissions matrix (admin has all, employee has view-only on most)
function makeMatrix(role: string): Record<string, Record<Action, boolean>> {
  const m: Record<string, Record<Action, boolean>> = {};
  MODULES.forEach((mod) => {
    if (role === "Super Admin" || role === "Agency Admin") {
      m[mod] = { view: true, edit: true, delete: true, approve: true };
    } else if (role === "Branch Manager") {
      m[mod] = { view: true, edit: true, delete: mod === "Bookings" || mod === "Customers", approve: mod === "Bookings" || mod === "Quotations" };
    } else if (role === "Accountant") {
      m[mod] = { view: mod !== "Settings", edit: mod === "Payments" || mod === "Reports", delete: false, approve: mod === "Payments" };
    } else {
      m[mod] = { view: mod !== "Settings" && mod !== "Employees", edit: mod === "Bookings" || mod === "Customers" || mod === "Quotations", delete: false, approve: false };
    }
  });
  return m;
}

const TIMEZONES = ["Asia/Kolkata (IST, UTC+5:30)", "Asia/Dubai (GST, UTC+4)", "Asia/Singapore (SGT, UTC+8)", "Europe/London (GMT, UTC+0)", "America/New_York (EST, UTC-5)"];
const LANGUAGES = ["English", "हिंदी (Hindi)", "தமிழ் (Tamil)", "తెలుగు (Telugu)", "ಕನ್ನಡ (Kannada)"];
const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD-MMM-YYYY"];

export function SettingsView() {
  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Manage your agency profile, users, system & security" />

      <Tabs defaultValue="company">
        <TabsList className="w-full sm:w-auto overflow-x-auto">
          <TabsTrigger value="company"><Building2 className="w-3.5 h-3.5 mr-1.5" /> Company</TabsTrigger>
          <TabsTrigger value="users"><Users className="w-3.5 h-3.5 mr-1.5" /> Users & Roles</TabsTrigger>
          <TabsTrigger value="system"><Cog className="w-3.5 h-3.5 mr-1.5" /> System</TabsTrigger>
          <TabsTrigger value="security"><Shield className="w-3.5 h-3.5 mr-1.5" /> Security</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-4"><CompanyTab /></TabsContent>
        <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
        <TabsContent value="system" className="mt-4"><SystemTab /></TabsContent>
        <TabsContent value="security" className="mt-4"><SecurityTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function CompanyTab() {
  const { toast } = useToast();
  const handleSave = () => toast({ title: "Saved", description: "Company profile updated successfully." });
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Agency Profile</CardTitle>
          <CardDescription>Basic information about your travel agency</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logo upload */}
          <div className="flex items-center gap-4">
            <Avatar className="w-20 h-20">
              <AvatarFallback className="bg-gradient-to-br from-teal-500 to-emerald-600 text-white text-2xl font-bold">
                WT
              </AvatarFallback>
            </Avatar>
            <div>
              <Button variant="outline" size="sm"><Camera className="w-3.5 h-3.5 mr-1.5" /> Upload Logo</Button>
              <p className="text-[11px] text-muted-foreground mt-1.5">PNG or JPG, max 2MB. Recommended 256×256px.</p>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Agency Name</Label>
              <Input defaultValue="Wanderlust Travels Pvt Ltd" />
            </div>
            <div className="space-y-1.5">
              <Label>Brand Name</Label>
              <Input defaultValue="Wanderlust Travels" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Registered Address</Label>
              <Textarea defaultValue="Plot 14, Andheri Industrial Estate, Andheri East, Mumbai, Maharashtra 400069, India" rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>GST Number</Label>
              <Input defaultValue="27AABCW1234M1Z5" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>PAN Number</Label>
              <Input defaultValue="AABCW1234M" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Email</Label>
              <Input type="email" defaultValue="contact@wanderlusttravels.in" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Phone</Label>
              <Input defaultValue="+91 22 4000 1234" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Website</Label>
              <Input defaultValue="https://www.wanderlusttravels.in" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline">Cancel</Button>
            <Button onClick={handleSave} className="bg-teal-600 hover:bg-teal-700"><Save className="w-4 h-4 mr-1.5" /> Save Changes</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400 mb-2">Enterprise Plan</Badge>
            <p className="text-2xl font-bold">₹25,000<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
            <p className="text-xs text-muted-foreground mt-1">Renews on Feb 19, 2025</p>
            <Separator className="my-3" />
            <div className="space-y-1.5 text-xs">
              {["Unlimited bookings", "All modules included", "Priority support", "API access (10K/day)", "Custom branding"].map((f) => (
                <div key={f} className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />{f}</div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-3">Manage Plan</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Compliance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex items-center justify-between"><span className="text-muted-foreground">IATA Accredited</span><Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">Verified</Badge></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">TAAI Member</span><Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">Active</Badge></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">GST Filing</span><Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">Pending</Badge></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UsersTab() {
  const [selectedRole, setSelectedRole] = useState("Branch Manager");
  const [matrix, setMatrix] = useState<Record<string, Record<Action, boolean>>>(makeMatrix("Branch Manager"));
  const [passwordPolicy, setPasswordPolicy] = useState({
    minLength: 10, requireUppercase: true, requireNumbers: true, requireSymbols: true,
    expiryDays: 90, twoFactor: true,
  });

  const togglePermission = (mod: string, action: Action) => {
    setMatrix((prev) => ({
      ...prev,
      [mod]: { ...prev[mod], [action]: !prev[mod][action] },
    }));
  };

  const handleRoleChange = (role: string) => {
    setSelectedRole(role);
    setMatrix(makeMatrix(role));
  };

  const permissionsCount = (role: string) => {
    const m = makeMatrix(role);
    return MODULES.reduce((sum, mod) => sum + ACTIONS.filter((a) => m[mod][a]).length, 0);
  };

  return (
    <div className="space-y-4">
      {/* Roles table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Roles & Access</CardTitle>
            <CardDescription>Define what each role can do</CardDescription>
          </div>
          <Button size="sm" variant="outline"><Plus className="w-3.5 h-3.5 mr-1.5" /> New Role</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Permissions</TableHead>
                <TableHead className="text-right">Users</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROLES.map((r) => (
                <TableRow
                  key={r.role}
                  className={cn("cursor-pointer hover:bg-muted/40", selectedRole === r.role && "bg-teal-50/50 dark:bg-teal-500/5")}
                  onClick={() => handleRoleChange(r.role)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={cn("w-7 h-7 rounded-md flex items-center justify-center", r.color)}>
                        <Shield className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-sm font-medium">{r.role}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">{permissionsCount(r.role)} / {MODULES.length * 4}</TableCell>
                  <TableCell className="text-right text-sm">{r.users}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" className="h-7 w-7"><Pencil className="w-3.5 h-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Permissions matrix */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Permissions Matrix — <span className="text-teal-600">{selectedRole}</span></CardTitle>
          <CardDescription>Toggle module-level permissions for this role</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  {ACTIONS.map((a) => <TableHead key={a} className="text-center capitalize">{a}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {MODULES.map((mod) => (
                  <TableRow key={mod}>
                    <TableCell className="font-medium text-sm">{mod}</TableCell>
                    {ACTIONS.map((a) => (
                      <TableCell key={a} className="text-center">
                        <Checkbox
                          checked={matrix[mod][a]}
                          onCheckedChange={() => togglePermission(mod, a)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Password policy */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-teal-600" /> Password Policy
          </CardTitle>
          <CardDescription>Enforce strong password requirements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Minimum Length</Label>
              <Input
                type="number"
                value={passwordPolicy.minLength}
                onChange={(e) => setPasswordPolicy({ ...passwordPolicy, minLength: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password Expiry (days)</Label>
              <Input
                type="number"
                value={passwordPolicy.expiryDays}
                onChange={(e) => setPasswordPolicy({ ...passwordPolicy, expiryDays: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="space-y-2">
            {[
              { key: "requireUppercase", label: "Require uppercase letters (A-Z)" },
              { key: "requireNumbers", label: "Require numbers (0-9)" },
              { key: "requireSymbols", label: "Require special characters (!@#$%)" },
              { key: "twoFactor", label: "Enforce two-factor authentication (2FA)" },
            ].map((p) => (
              <div key={p.key} className="flex items-center justify-between p-2.5 rounded-lg border border-border">
                <span className="text-sm">{p.label}</span>
                <Switch
                  checked={(passwordPolicy as any)[p.key]}
                  onCheckedChange={(v) => setPasswordPolicy({ ...passwordPolicy, [p.key]: v })}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SystemTab() {
  const { toast } = useToast();
  const testConnection = (channel: string) => {
    toast({ title: `Testing ${channel}...`, description: "Connection test initiated. This may take a few seconds." });
    setTimeout(() => toast({ title: `${channel} connected`, description: "Connection test successful." }), 1500);
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4 text-teal-600" /> Localization</CardTitle>
          <CardDescription>Regional & language settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Select defaultValue="Asia/Kolkata (IST, UTC+5:30)">
              <SelectTrigger className="w-full"><Clock className="w-3.5 h-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select defaultValue="INR">
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">₹ Indian Rupee (INR)</SelectItem>
                <SelectItem value="USD">$ US Dollar (USD)</SelectItem>
                <SelectItem value="AED">د.إ UAE Dirham (AED)</SelectItem>
                <SelectItem value="EUR">€ Euro (EUR)</SelectItem>
                <SelectItem value="SGD">S$ Singapore Dollar (SGD)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Language</Label>
            <Select defaultValue="English">
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Date Format</Label>
            <Select defaultValue="DD/MM/YYYY">
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Server className="w-4 h-4 text-teal-600" /> Communication Channels</CardTitle>
          <CardDescription>Configure notification gateways</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { icon: Mail, name: "Email Notifications", desc: "SMTP via SendGrid", enabled: true, color: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400" },
            { icon: MessageSquare, name: "SMS Gateway", desc: "MSG91 · 12,450 credits", enabled: true, color: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" },
            { icon: Smartphone, name: "WhatsApp Business", desc: "Twilio API · Connected", enabled: true, color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" },
            { icon: Phone, name: "Voice Notifications", desc: "Exotel · Disabled", enabled: false, color: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" },
          ].map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.name} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", c.color)}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground">{c.desc}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => testConnection(c.name)} className="h-7 text-xs">
                  <Wifi className="w-3 h-3 mr-1" /> Test
                </Button>
                <Switch defaultChecked={c.enabled} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "App Version", value: "v3.2.1" },
              { label: "Last Backup", value: "2 hours ago" },
              { label: "Database Size", value: "1.4 GB" },
              { label: "Uptime", value: "99.98%" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border p-3">
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
                <p className="text-sm font-semibold mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SecurityTab() {
  const { toast } = useToast();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Lock className="w-4 h-4 text-teal-600" /> Two-Factor Authentication</CardTitle>
          <CardDescription>Extra layer of security for your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-sm font-medium">2FA Enabled</p>
                <p className="text-[11px] text-muted-foreground">Authenticator app · configured Jan 8</p>
              </div>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 flex items-center justify-center">
                <Smartphone className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-sm font-medium">SMS Backup</p>
                <p className="text-[11px] text-muted-foreground">+91 xxxx x3333</p>
              </div>
            </div>
            <Switch defaultChecked />
          </div>
          <Button variant="outline" className="w-full" onClick={() => toast({ title: "Backup codes", description: "New backup codes generated. Save them securely." })}>
            <KeyRound className="w-4 h-4 mr-1.5" /> Regenerate Backup Codes
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4 text-teal-600" /> Session & Timeout</CardTitle>
          <CardDescription>Control active session duration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Session Timeout (minutes)</Label>
            <Input type="number" defaultValue={30} />
            <p className="text-[10px] text-muted-foreground">Users will be auto-logged out after inactivity</p>
          </div>
          <div className="space-y-1.5">
            <Label>Max Concurrent Sessions</Label>
            <Input type="number" defaultValue={3} />
          </div>
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium">Force re-login on password change</p>
                <p className="text-[11px] text-muted-foreground">Logout all active sessions</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium">Restrict to single device</p>
                <p className="text-[11px] text-muted-foreground">One session per user</p>
              </div>
              <Switch />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4 text-teal-600" /> IP Whitelist</CardTitle>
          <CardDescription>Restrict admin access to known IPs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {["103.21.58.14 (Mumbai Office)", "49.205.122.88 (Branch - Delhi)", "106.51.74.22 (Branch - Bangalore)"].map((ip) => (
            <div key={ip} className="flex items-center justify-between p-2.5 rounded-lg border border-border">
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs font-mono">{ip}</span>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-500"><X className="w-3.5 h-3.5" /></Button>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Input placeholder="Add new IP address" className="font-mono text-xs" />
            <Button variant="outline"><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-500/5 mt-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs">Block all unknown IPs</span>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Server className="w-4 h-4 text-teal-600" /> API Rate Limits</CardTitle>
          <CardDescription>Throttle external API consumption</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { name: "Flight Search API", limit: "1000 / min", used: 62, color: "bg-teal-500" },
            { name: "Hotel Search API", limit: "500 / min", used: 41, color: "bg-amber-500" },
            { name: "Booking API", limit: "100 / min", used: 78, color: "bg-rose-500" },
            { name: "Payment API", limit: "50 / min", used: 23, color: "bg-emerald-500" },
          ].map((r) => (
            <div key={r.name}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground">{r.used}% of {r.limit}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={cn("h-full rounded-full", r.color)} style={{ width: `${r.used}%` }} />
              </div>
            </div>
          ))}
          <Separator className="my-2" />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="space-y-1">
              <Label className="text-[11px]">Default Rate (req/min)</Label>
              <Input type="number" defaultValue={1000} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Burst Limit</Label>
              <Input type="number" defaultValue={1500} />
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={() => toast({ title: "Settings saved", description: "API rate limits updated." })}>
            <Save className="w-4 h-4 mr-1.5" /> Save Rate Limits
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
