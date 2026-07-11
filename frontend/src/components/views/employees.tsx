"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Users, UserCheck, UserMinus, Calendar, Plus, Search, Mail, Phone,
  Eye, Pencil, Briefcase, Building2, Award, Target, TrendingUp, Wallet,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useDemoDataStore } from "@/store/demo-data-store";
import type { Employee } from "@/types";
import {
  formatINR, formatFullINR, PageHeader, StatusBadge, initials, avatarGradient,
} from "@/components/shared/ui-helpers";
import { cn } from "@/lib/utils";

const DEPARTMENTS = ["All", "Sales", "Management", "Accounts", "Operations", "Support"];
const BRANCHES = ["All", "Mumbai - Andheri", "Delhi - CP", "Bangalore - Indiranagar", "Chennai - T. Nagar"];
const STATUSES = ["All", "Active", "On Leave", "Inactive"];
const ROLES = ["employee", "branch_manager", "accountant"];

const PERFORMANCE_TREND = [
  { month: "Aug", value: 320000 },
  { month: "Sep", value: 410000 },
  { month: "Oct", value: 380000 },
  { month: "Nov", value: 540000 },
  { month: "Dec", value: 670000 },
  { month: "Jan", value: 612000 },
];

export function EmployeesView() {
  const employees = useDemoDataStore((s) => s.employees);
  const { toast } = useToast();
  const [department, setDepartment] = useState("All");
  const [branch, setBranch] = useState("All");
  const [status, setStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Employee | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (department !== "All" && e.department !== department) return false;
      if (branch !== "All" && e.branch !== branch) return false;
      if (status !== "All" && e.status !== status) return false;
      if (search && !`${e.name} ${e.email} ${e.designation}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [department, branch, status, search, employees]);

  const active = employees.filter((e) => e.status === "Active").length;
  const onLeave = employees.filter((e) => e.status === "On Leave").length;
  const avgAttendance = Math.round(employees.reduce((s, e) => s + e.attendance, 0) / employees.length);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Employees"
        subtitle={`${employees.length} team members across ${new Set(employees.map((e) => e.branch)).size} branches`}
        action={
          <Button onClick={() => setAddOpen(true)} className="bg-teal-600 hover:bg-teal-700">
            <Plus className="w-4 h-4 mr-1.5" /> Add Employee
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Users, label: "Total Employees", value: employees.length.toString(), color: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400" },
          { icon: UserCheck, label: "Active", value: active.toString(), color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" },
          { icon: UserMinus, label: "On Leave", value: onLeave.toString(), color: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" },
          { icon: Calendar, label: "Avg Attendance", value: `${avgAttendance}%`, color: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", s.color)}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                  </div>
                  <p className="text-xl font-bold mt-2.5 tracking-tight">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, designation..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <Briefcase className="w-3.5 h-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Building2 className="w-3.5 h-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto scroll-thin">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Salary</TableHead>
                  <TableHead className="min-w-[140px]">Target vs Achieved</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => {
                  const pct = e.target > 0 ? Math.min(100, Math.round((e.achieved / e.target) * 100)) : 0;
                  return (
                    <TableRow key={e.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelected(e)}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="w-9 h-9">
                            <AvatarFallback className={cn("bg-gradient-to-br text-white text-xs font-semibold", avatarGradient(e.name))}>
                              {initials(e.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{e.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{e.designation}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-medium">{e.department}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.branch}</TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground capitalize">{e.role.replace("_", " ")}</span>
                      </TableCell>
                      <TableCell><StatusBadge status={e.status} /></TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatINR(e.salary)}</TableCell>
                      <TableCell>
                        {e.target > 0 ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-muted-foreground">{formatINR(e.achieved)}</span>
                              <span className={cn("font-semibold", pct >= 100 ? "text-emerald-600" : "text-amber-600")}>{pct}%</span>
                            </div>
                            <Progress value={pct} className={cn("h-1.5", pct >= 100 && "[&_[data-slot=progress-indicator]]:bg-emerald-500")} />
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className={cn("text-xs font-medium", e.attendance >= 95 ? "text-emerald-600" : e.attendance >= 90 ? "text-amber-600" : "text-rose-600")}>
                            {e.attendance}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(ev) => ev.stopPropagation()}>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSelected(e)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toast({ title: "Edit mode", description: `Editing ${e.name}` })}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-sm text-muted-foreground">
                      No employees match your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AddEmployeeDialog open={addOpen} onOpenChange={setAddOpen} />
      <EmployeeDetailDialog employee={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function AddEmployeeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const addEmployee = useDemoDataStore((s) => s.addEmployee);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [designation, setDesignation] = useState("Travel Consultant");
  const [department, setDepartment] = useState<Employee["department"]>("Sales");
  const [branch, setBranch] = useState("Mumbai - Andheri");
  const [role, setRole] = useState("employee");
  const [salary, setSalary] = useState("40000");
  const [target, setTarget] = useState("500000");

  const resetForm = () => {
    setName(""); setEmail(""); setPhone(""); setDesignation("Travel Consultant");
    setDepartment("Sales"); setBranch("Mumbai - Andheri"); setRole("employee");
    setSalary("40000"); setTarget("500000");
  };

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) {
      toast({ title: "Missing fields", description: "Name and email are required", variant: "destructive" });
      return;
    }
    const result = await addEmployee({
      name,
      email,
      phone: phone || "+91 98000 00000",
      designation,
      department,
      branch,
      role: role as Employee["role"],
      salary: Number(salary) || 40000,
      target: Number(target) || 500000,
    });
    toast({
      title: "Employee added",
      description: result?.tempPassword
        ? `${name} onboarded. Login: ${email} · Temp password: ${result.tempPassword} (share this once — it won't be shown again).`
        : "New employee onboarded successfully.",
    });
    onOpenChange(false);
    resetForm();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Employee</DialogTitle>
          <DialogDescription>Onboard a new team member to your agency.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Full Name</Label>
            <Input placeholder="e.g. Anjali Sharma" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" placeholder="anjali@agency.in" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input placeholder="+91 98xxx xxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Designation</Label>
            <Input placeholder="Travel Consultant" value={designation} onChange={(e) => setDesignation(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select value={department} onValueChange={(v) => setDepartment(v as Employee["department"])}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.filter((d) => d !== "All").map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Branch</Label>
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BRANCHES.filter((b) => b !== "All").map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Salary (₹/month)</Label>
            <Input type="number" placeholder="40000" value={salary} onChange={(e) => setSalary(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Target (₹/month)</Label>
            <Input type="number" placeholder="500000" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} className="bg-teal-600 hover:bg-teal-700">Add Employee</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmployeeDetailDialog({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  if (!employee) return null;
  const pct = employee.target > 0 ? Math.min(100, Math.round((employee.achieved / employee.target) * 100)) : 0;
  // Mock attendance calendar — 30 days, present/absent based on attendance %
  const days = Array.from({ length: 30 }, (_, i) => {
    const seed = (employee.name.charCodeAt(0) + i) % 100;
    const present = seed < employee.attendance;
    const isWeekend = i % 7 === 5 || i % 7 === 6;
    return { day: i + 1, present: isWeekend ? null : present, weekend: isWeekend };
  });

  return (
    <Dialog open={!!employee} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Employee Profile</DialogTitle>
        </DialogHeader>

        <div className="flex items-start gap-4">
          <Avatar className="w-16 h-16">
            <AvatarFallback className={cn("bg-gradient-to-br text-white text-lg font-bold", avatarGradient(employee.name))}>
              {initials(employee.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold">{employee.name}</h3>
            <p className="text-sm text-muted-foreground">{employee.designation}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <Badge variant="outline">{employee.department}</Badge>
              <StatusBadge status={employee.status} />
              <span className="text-[11px] text-muted-foreground capitalize">{employee.role.replace("_", " ")}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="truncate">{employee.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{employee.phone}</span>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{employee.branch}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Joined {employee.joinDate}</span>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Wallet, label: "Salary", value: formatINR(employee.salary), color: "text-teal-600" },
            { icon: Award, label: "Incentives", value: formatINR(employee.incentives), color: "text-amber-600" },
            { icon: Target, label: "Target", value: employee.target > 0 ? formatINR(employee.target) : "—", color: "text-rose-600" },
            { icon: TrendingUp, label: "Achieved", value: employee.target > 0 ? formatINR(employee.achieved) : "—", color: "text-emerald-600" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-lg border border-border p-2.5">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-[10px]">{s.label}</span>
                </div>
                <p className={cn("text-sm font-semibold", s.color)}>{s.value}</p>
              </div>
            );
          })}
        </div>

        {employee.target > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Target Achievement</span>
              <span className={cn("text-sm font-bold", pct >= 100 ? "text-emerald-600" : "text-amber-600")}>{pct}%</span>
            </div>
            <Progress value={pct} className={cn("h-2", pct >= 100 && "[&_[data-slot=progress-indicator]]:bg-emerald-500")} />
            <p className="text-[11px] text-muted-foreground">
              {pct >= 100
                ? `Exceeded target by ${formatINR(employee.achieved - employee.target)} 🎉`
                : `${formatINR(employee.target - employee.achieved)} to reach target`}
            </p>
          </div>
        )}

        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-medium mb-2">Performance Trend (6 months)</p>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={PERFORMANCE_TREND} margin={{ left: -28, right: 4, top: 4 }}>
              <defs>
                <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 100000}L`} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 11 }}
                formatter={(v: number) => formatFullINR(v)}
              />
              <Area type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={2} fill="url(#perfGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium">Attendance — Last 30 Days</p>
            <span className="text-xs text-muted-foreground">{employee.attendance}% present</span>
          </div>
          <div className="grid grid-cols-10 gap-1">
            {days.map((d) => (
              <div
                key={d.day}
                title={`Day ${d.day}`}
                className={cn(
                  "aspect-square rounded-sm text-[8px] flex items-center justify-center",
                  d.weekend && "bg-muted/50",
                  !d.weekend && d.present && "bg-emerald-400 dark:bg-emerald-500/70",
                  !d.weekend && !d.present && "bg-rose-300 dark:bg-rose-500/60",
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400" /> Present</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-300" /> Absent</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-muted" /> Weekend</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={onClose}>Edit Profile</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
