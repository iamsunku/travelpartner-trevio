"use client";

import { useEffect, useState } from "react";
import {
  CalendarCheck, LogIn, LogOut, Clock, Plus, CheckCircle2, XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/app-store";
import { api, type ApiAttendance, type ApiEmployee, type ApiLeave, type ApiPayrollEntry, type ApiShift } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { PageShell, PageHeader, MetricCard, SectionHeader, StatusBadge, formatINR } from "@/components/shared/ui-helpers";

const LEAVE_TYPES = ["Casual", "Sick", "Earned", "Unpaid"] as const;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtTime(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

export function AttendanceLeaveView() {
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const isManager = user ? hasPermission(user, "employees") : false;

  const [attendance, setAttendance] = useState<ApiAttendance[]>([]);
  const [teamAttendance, setTeamAttendance] = useState<ApiAttendance[]>([]);
  const [teamEmployees, setTeamEmployees] = useState<ApiEmployee[]>([]);
  const [myLeaves, setMyLeaves] = useState<ApiLeave[]>([]);
  const [teamLeaves, setTeamLeaves] = useState<ApiLeave[]>([]);
  const [shifts, setShifts] = useState<ApiShift[]>([]);
  const [payroll, setPayroll] = useState<ApiPayrollEntry[]>([]);
  const [requestOpen, setRequestOpen] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [payrollOpen, setPayrollOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const today = todayISO();
  const todayRecord = attendance.find((a) => a.date === today);

  function refresh() {
    if (!user) return;
    api.getAttendance(user.id).then((res) => setAttendance(res.attendance)).catch(() => undefined);
    api.getLeaves().then((res) => {
      setMyLeaves(res.leaves.filter((l) => l.userId === user.id));
      if (isManager) setTeamLeaves(res.leaves.filter((l) => l.userId !== user.id));
    }).catch(() => undefined);
    api.getShifts().then((res) => setShifts(res.shifts)).catch(() => undefined);
    if (isManager) {
      api.getAttendance().then((res) => setTeamAttendance(res.attendance)).catch(() => undefined);
      api.getEmployees(user.agencyId || undefined).then((res) => setTeamEmployees(res.employees)).catch(() => undefined);
      api.getPayroll().then((res) => setPayroll(res.entries)).catch(() => undefined);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function handleCheckIn() {
    setBusy(true);
    try {
      await api.checkIn();
      toast({ title: "Checked in", description: `Marked present at ${fmtTime(new Date().toISOString())}.` });
      refresh();
    } catch {
      toast({ title: "Couldn't check in", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckOut() {
    setBusy(true);
    try {
      await api.checkOut();
      toast({ title: "Checked out", description: "Have a great day!" });
      refresh();
    } catch {
      toast({ title: "Couldn't check out", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleLeaveDecision(id: string, status: "Approved" | "Rejected") {
    try {
      await api.updateLeaveStatus(id, status);
      toast({ title: `Leave ${status.toLowerCase()}` });
      refresh();
    } catch {
      toast({ title: "Couldn't update leave", variant: "destructive" });
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Attendance & Leave"
        subtitle="Check in/out, shifts, leave, and payroll scaffold"
        action={
          <Button onClick={() => setRequestOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-1.5" /> Request Leave
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard icon={CalendarCheck} label="Today" value={todayRecord?.status || "Not checked in"} color="bg-primary/10 text-primary dark:bg-primary/15 dark:text-brand-teal" index={0} />
        <MetricCard icon={LogIn} label="Check-in" value={fmtTime(todayRecord?.checkIn)} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" index={1} />
        <MetricCard icon={LogOut} label="Check-out" value={fmtTime(todayRecord?.checkOut)} color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" index={2} />
        <MetricCard icon={Clock} label="Leave requests" value={`${myLeaves.filter((l) => l.status === "Pending").length} pending`} color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" index={3} />
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2">
          <Button onClick={handleCheckIn} disabled={busy || !!todayRecord?.checkIn} className="bg-emerald-600 hover:bg-emerald-700">
            <LogIn className="w-4 h-4 mr-1.5" /> Check In
          </Button>
          <Button onClick={handleCheckOut} disabled={busy || !todayRecord?.checkIn || !!todayRecord?.checkOut} variant="outline">
            <LogOut className="w-4 h-4 mr-1.5" /> Check Out
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="attendance">
        <TabsList className="bg-muted/60 flex flex-wrap h-auto">
          <TabsTrigger value="attendance">My Attendance</TabsTrigger>
          <TabsTrigger value="leaves">My Leaves</TabsTrigger>
          <TabsTrigger value="shifts">Shifts</TabsTrigger>
          {isManager && <TabsTrigger value="roster">Team Attendance</TabsTrigger>}
          {isManager && <TabsTrigger value="approvals">Approvals</TabsTrigger>}
          {isManager && <TabsTrigger value="payroll">Payroll</TabsTrigger>}
        </TabsList>

        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <SectionHeader title="Recent Attendance" description={`Last ${attendance.length} recorded days`} />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm">{a.date}</TableCell>
                      <TableCell className="text-sm">{fmtTime(a.checkIn)}</TableCell>
                      <TableCell className="text-sm">{fmtTime(a.checkOut)}</TableCell>
                      <TableCell><StatusBadge status={a.status} /></TableCell>
                    </TableRow>
                  ))}
                  {attendance.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-10 text-sm text-muted-foreground">No attendance recorded yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaves" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <SectionHeader title="My Leave Requests" />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myLeaves.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-sm">{l.type}</TableCell>
                      <TableCell className="text-sm">{l.fromDate}</TableCell>
                      <TableCell className="text-sm">{l.toDate}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">{l.reason}</TableCell>
                      <TableCell><StatusBadge status={l.status} /></TableCell>
                    </TableRow>
                  ))}
                  {myLeaves.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-10 text-sm text-muted-foreground">No leave requests yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shifts" className="mt-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <SectionHeader title="Shift roster" description="Scheduled desk / ops / sales shifts" />
              {isManager && (
                <Button size="sm" onClick={() => setShiftOpen(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add shift
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    {isManager && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">{s.date}</TableCell>
                      <TableCell className="text-sm">{s.employeeName}</TableCell>
                      <TableCell className="text-sm">{s.startTime} – {s.endTime}</TableCell>
                      <TableCell className="text-sm">{s.roleLabel || "—"}</TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                      {isManager && (
                        <TableCell>
                          {s.status === "Scheduled" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              onClick={async () => {
                                await api.updateShift(s.id, { status: "CheckedIn" });
                                refresh();
                              }}
                            >
                              Check in
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {shifts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isManager ? 6 : 5} className="text-center py-10 text-sm text-muted-foreground">
                        No shifts scheduled yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {isManager && (
          <TabsContent value="roster" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <SectionHeader title="Today's Attendance" description="Who's checked in across your branch, as of now" />
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamEmployees.map((e) => {
                      // Attendance.userId references the User table, not the Employee table (they're
                      // separate records linked only by email) — match on email, not id.
                      const record = teamAttendance.find((a) => a.date === today && a.user?.email === e.email);
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="text-sm">{e.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{e.designation}</TableCell>
                          <TableCell className="text-sm">{fmtTime(record?.checkIn)}</TableCell>
                          <TableCell className="text-sm">{fmtTime(record?.checkOut)}</TableCell>
                          <TableCell><StatusBadge status={record?.status || "Not checked in"} /></TableCell>
                        </TableRow>
                      );
                    })}
                    {teamEmployees.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center py-10 text-sm text-muted-foreground">No team members found.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isManager && (
          <TabsContent value="approvals" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <SectionHeader title="Team Leave Requests" description="Requests from your branch / agency" />
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamLeaves.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-sm">{l.userName}</TableCell>
                        <TableCell className="text-sm">{l.type}</TableCell>
                        <TableCell className="text-sm">{l.fromDate}</TableCell>
                        <TableCell className="text-sm">{l.toDate}</TableCell>
                        <TableCell><StatusBadge status={l.status} /></TableCell>
                        <TableCell className="text-right">
                          {l.status === "Pending" ? (
                            <div className="flex justify-end gap-1.5">
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => handleLeaveDecision(l.id, "Approved")}>
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600" onClick={() => handleLeaveDecision(l.id, "Rejected")}>
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">{l.approvedByName || "—"}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {teamLeaves.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-10 text-sm text-muted-foreground">No team leave requests.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isManager && (
          <TabsContent value="payroll" className="mt-4">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <SectionHeader title="Payroll scaffold" description="Draft monthly pay entries from employee salary / incentives" />
                <Button size="sm" onClick={() => setPayrollOpen(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add entry
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Base</TableHead>
                      <TableHead>Incentives</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payroll.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">{p.period}</TableCell>
                        <TableCell className="text-sm">{p.employeeName}</TableCell>
                        <TableCell className="text-sm">{formatINR(p.baseSalary)}</TableCell>
                        <TableCell className="text-sm">{formatINR(p.incentives)}</TableCell>
                        <TableCell className="text-sm">{formatINR(p.deductions)}</TableCell>
                        <TableCell className="text-sm font-semibold">{formatINR(p.netPay)}</TableCell>
                        <TableCell><StatusBadge status={p.status} /></TableCell>
                        <TableCell>
                          {p.status === "Draft" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              onClick={async () => {
                                await api.updatePayrollEntry(p.id, { status: "Approved" });
                                refresh();
                              }}
                            >
                              Approve
                            </Button>
                          )}
                          {p.status === "Approved" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              onClick={async () => {
                                await api.updatePayrollEntry(p.id, { status: "Paid" });
                                refresh();
                              }}
                            >
                              Mark paid
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {payroll.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-sm text-muted-foreground">
                          No payroll entries yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <LeaveRequestDialog open={requestOpen} onOpenChange={setRequestOpen} onCreated={refresh} />
      <ShiftDialog open={shiftOpen} onOpenChange={setShiftOpen} employees={teamEmployees} onCreated={refresh} />
      <PayrollDialog open={payrollOpen} onOpenChange={setPayrollOpen} employees={teamEmployees} onCreated={refresh} />
    </PageShell>
  );
}

function LeaveRequestDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [type, setType] = useState<typeof LEAVE_TYPES[number]>("Casual");
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate, setToDate] = useState(todayISO());
  const [reason, setReason] = useState("");

  async function handleSubmit() {
    if (!reason.trim()) {
      toast({ title: "Reason required", variant: "destructive" });
      return;
    }
    try {
      await api.createLeave({ type, fromDate, toDate, reason });
      toast({ title: "Leave requested", description: "Your manager will review it shortly." });
      onOpenChange(false);
      setReason("");
      onCreated();
    } catch {
      toast({ title: "Couldn't submit request", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Request Leave</DialogTitle>
          <DialogDescription>Submit a leave request for approval.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Leave Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof LEAVE_TYPES[number])}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Textarea rows={3} placeholder="Briefly describe the reason..." value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} className="bg-primary hover:bg-primary/90">Submit Request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShiftDialog({
  open,
  onOpenChange,
  employees,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employees: ApiEmployee[];
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [employeeName, setEmployeeName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [roleLabel, setRoleLabel] = useState("desk");

  async function handleSubmit() {
    if (!employeeName) {
      toast({ title: "Pick an employee", variant: "destructive" });
      return;
    }
    try {
      await api.createShift({ employeeName, employeeId: employeeId || undefined, date, startTime, endTime, roleLabel });
      toast({ title: "Shift scheduled" });
      onOpenChange(false);
      onCreated();
    } catch {
      toast({ title: "Couldn't create shift", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Schedule shift</DialogTitle>
          <DialogDescription>Assign a desk, ops, or sales shift.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Employee</Label>
            <Select
              value={employeeId || "__none"}
              onValueChange={(v) => {
                if (v === "__none") {
                  setEmployeeId("");
                  setEmployeeName("");
                  return;
                }
                const emp = employees.find((e) => e.id === v);
                setEmployeeId(v);
                setEmployeeName(emp?.name || "");
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Select…</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={roleLabel} onValueChange={setRoleLabel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["desk", "ops", "sales"].map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Save shift</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PayrollDialog({
  open,
  onOpenChange,
  employees,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employees: ApiEmployee[];
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [period, setPeriod] = useState(currentPeriod());
  const [baseSalary, setBaseSalary] = useState("");
  const [incentives, setIncentives] = useState("0");
  const [deductions, setDeductions] = useState("0");

  async function handleSubmit() {
    if (!employeeName || !baseSalary) {
      toast({ title: "Employee and base salary required", variant: "destructive" });
      return;
    }
    try {
      await api.createPayrollEntry({
        employeeId: employeeId || undefined,
        employeeName,
        period,
        baseSalary: Number(baseSalary) || 0,
        incentives: Number(incentives) || 0,
        deductions: Number(deductions) || 0,
      });
      toast({ title: "Payroll entry created" });
      onOpenChange(false);
      onCreated();
    } catch {
      toast({ title: "Couldn't create payroll entry", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Payroll entry</DialogTitle>
          <DialogDescription>Draft a monthly pay line for an employee.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Employee</Label>
            <Select
              value={employeeId || "__none"}
              onValueChange={(v) => {
                if (v === "__none") {
                  setEmployeeId("");
                  setEmployeeName("");
                  setBaseSalary("");
                  return;
                }
                const emp = employees.find((e) => e.id === v);
                setEmployeeId(v);
                setEmployeeName(emp?.name || "");
                setBaseSalary(String(emp?.salary || 0));
                setIncentives(String(emp?.incentives || 0));
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Select…</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Period (YYYY-MM)</Label>
              <Input value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Base salary</Label>
              <Input value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Incentives</Label>
              <Input value={incentives} onChange={(e) => setIncentives(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Deductions</Label>
              <Input value={deductions} onChange={(e) => setDeductions(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Create draft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
