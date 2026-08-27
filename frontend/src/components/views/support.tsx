"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Plus, Search, Send, MessageCircle, Plane, CreditCard,
  RefreshCw, FileText, User, Headphones, ArrowRight, CheckCircle2, Clock, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import {
  PageShell, PageHeader, MetricCard, SectionHeader, BrandHero, StatusBadge,
} from "@/components/shared/ui-helpers";
import { cn } from "@/lib/utils";
import { api, type SupportTicketApi, type SupportTicketMessageApi } from "@/lib/api";
import { useAuthStore } from "@/store/app-store";
import {
  OPERATIONS_TYPES,
  DELIVERY_TYPES,
  departmentForOperationsType,
  labelForOperationsType,
  labelForDeliveryType,
  purposeForOperationsType,
  meaningForDeliveryType,
  type OperationsTypeValue,
  type DeliveryTypeValue,
} from "@/lib/support-ticket-taxonomy";

const FAQS = [
  { q: "How do I cancel a booking and get a refund?", a: "Visit Bookings → select the booking → click 'Cancel'. Refunds are processed within 5-7 business days to the original payment method. Cancellation charges depend on the airline/hotel policy and time of cancellation." },
  { q: "Can I modify my flight booking after confirmation?", a: "Yes, modifications are allowed subject to airline policy and fare rules. Go to Bookings → Edit. Date changes typically incur a fee plus fare difference. Name changes are usually not permitted by most airlines." },
  { q: "How does the wallet top-up work?", a: "Go to Wallet → Top Up, enter the amount, and pay via Razorpay/UPI/Card. The balance reflects instantly and can be used for any booking. Corporate accounts can also top up via bank transfer." },
  { q: "What is the commission structure for agents?", a: "Commission varies by service: Flights (3-5%), Hotels (8-15%), Holidays (5-10%). It is auto-credited to your wallet after booking completion. View detailed breakdown in the Commission module." },
  { q: "How do I generate a GST invoice for my customer?", a: "For any paid booking, open the booking details and click 'Generate Invoice'. Ensure your customer's GSTIN is added to their profile. Invoices are auto-generated for corporate customers and emailed monthly." },
  { q: "Can I create custom holiday packages for clients?", a: "Yes! Use the Holiday module → Create Package. You can add flights, hotels, transfers, and activities. Set your margin and generate a quotation. Packages can be saved as templates for future use." },
  { q: "How do I handle group bookings (10+ passengers)?", a: "Use the 'Group Booking' option in the Flights module. Enter passenger count, and our system will request a special group fare from the airline. Group fares offer better pricing but have separate cancellation policies." },
  { q: "Is there a mobile app for Travel Partner Pro?", a: "Yes, our mobile app is available for iOS and Android. Agents can manage bookings, receive notifications, and chat with customers on the go. Download from your agency dashboard → Settings → Mobile App." },
];

const HELP_CATEGORIES = [
  { icon: Plane, title: "Booking Management", desc: "Create, modify, cancel bookings across all services", articles: 24, color: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400" },
  { icon: CreditCard, title: "Payments & Wallet", desc: "Process payments, manage wallet, handle refunds", articles: 18, color: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" },
  { icon: RefreshCw, title: "Refunds & Cancellations", desc: "Refund policies, processing timelines, disputes", articles: 12, color: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" },
  { icon: FileText, title: "Holiday Packages", desc: "Package itineraries, inclusions, custom quotes", articles: 16, color: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400" },
  { icon: User, title: "Account & Profile", desc: "Manage agency profile, branches, users & roles", articles: 14, color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400" },
  { icon: Headphones, title: "Technical Support", desc: "APIs, integrations, troubleshooting, system status", articles: 22, color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" },
];

export function SupportView() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [operationsFilter, setOperationsFilter] = useState("All");
  const [deliveryFilter, setDeliveryFilter] = useState("All");
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [tickets, setTickets] = useState<SupportTicketApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SupportTicketApi | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("tickets");

  const loadTickets = useCallback(() => {
    setLoading(true);
    api.getSupportTickets({
      status: statusFilter !== "All" ? statusFilter : undefined,
      operationsType: operationsFilter !== "All" ? operationsFilter : undefined,
      deliveryType: deliveryFilter !== "All" ? deliveryFilter : undefined,
    })
      .then((res) => setTickets(res.tickets))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, [statusFilter, operationsFilter, deliveryFilter]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const filteredTickets = tickets.filter((t) => {
    if (search && !`${t.ticketId} ${t.subject} ${t.customerName} ${t.department}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const openTicket = (t: SupportTicketApi) => {
    setSelected(t);
    setSheetOpen(true);
  };

  const focusRaiseTicket = () => {
    setActiveTab("tickets");
    setRaiseOpen(true);
  };

  return (
    <PageShell>
      <PageHeader
        title="Support"
        subtitle="Tickets, FAQs & help center"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto overflow-x-auto bg-muted/60">
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="chat">Live Chat</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="help">Help Center</TabsTrigger>
        </TabsList>

        {/* TICKETS */}
        <TabsContent value="tickets" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard icon={MessageCircle} label="Open Tickets" value={String(tickets.filter((t) => t.status === "Open").length)} color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" index={0} />
            <MetricCard icon={RefreshCw} label="In Progress" value={String(tickets.filter((t) => t.status === "In Progress").length)} color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" index={1} />
            <MetricCard icon={CheckCircle2} label="Resolved" value={String(tickets.filter((t) => t.status === "Resolved").length)} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" index={2} />
            <MetricCard icon={Clock} label="Total Tickets" value={String(tickets.length)} color="bg-primary/10 text-primary dark:bg-primary/15 dark:text-brand-teal" index={3} />
          </div>

          <Card>
            <CardContent className="p-3">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search tickets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
                  </div>
                  <Button onClick={() => setRaiseOpen(true)} className="bg-primary hover:bg-primary/90 shrink-0">
                    <Plus className="w-4 h-4 mr-1.5" /> Raise Ticket
                  </Button>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      {["All", "Open", "In Progress", "Resolved", "Closed"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={operationsFilter} onValueChange={setOperationsFilter}>
                    <SelectTrigger className="w-full sm:flex-1"><SelectValue placeholder="Operations Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Operations Types</SelectItem>
                      {OPERATIONS_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={deliveryFilter} onValueChange={setDeliveryFilter}>
                    <SelectTrigger className="w-full sm:flex-1"><SelectValue placeholder="Delivery Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Delivery Types</SelectItem>
                      {DELIVERY_TYPES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="max-h-[560px] overflow-y-auto scroll-thin">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Ticket ID</TableHead>
                      <TableHead className="min-w-[180px]">Subject</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Operations</TableHead>
                      <TableHead>Delivery</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-12 text-sm text-muted-foreground">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                          Loading tickets...
                        </TableCell>
                      </TableRow>
                    ) : filteredTickets.map((t) => (
                      <TableRow key={t.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => openTicket(t)}>
                        <TableCell className="font-mono text-xs font-medium">{t.ticketId}</TableCell>
                        <TableCell>
                          <p className="text-sm font-medium line-clamp-1">{t.subject}</p>
                        </TableCell>
                        <TableCell className="text-sm">{t.customerName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]" title={purposeForOperationsType(t.operationsType)}>
                            {labelForOperationsType(t.operationsType)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]" title={meaningForDeliveryType(t.deliveryType)}>
                            {labelForDeliveryType(t.deliveryType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.department}</TableCell>
                        <TableCell>
                          <span className={cn("inline-flex items-center gap-1 text-xs font-medium",
                            t.priority === "Urgent" || t.priority === "Critical" ? "text-rose-600" :
                            t.priority === "High" ? "text-amber-600" :
                            t.priority === "Medium" ? "text-sky-600" : "text-slate-500")}>
                            <span className={cn("w-1.5 h-1.5 rounded-full",
                              t.priority === "Urgent" || t.priority === "Critical" ? "bg-rose-500" :
                              t.priority === "High" ? "bg-amber-500" :
                              t.priority === "Medium" ? "bg-sky-500" : "bg-slate-400")} />
                            {t.priority}
                          </span>
                        </TableCell>
                        <TableCell><StatusBadge status={t.status} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.assignedTo || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(t.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                    {!loading && filteredTickets.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-12 text-sm text-muted-foreground">No tickets found.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LIVE CHAT → ticket CTA */}
        <TabsContent value="chat" className="mt-4">
          <Card>
            <CardContent className="p-8 flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold">Need help from support?</p>
                <p className="text-sm text-muted-foreground max-w-md">
                  Conversations are tracked as support tickets so your team can reply with full history.
                  Create a ticket to start the thread.
                </p>
              </div>
              <Button className="bg-primary hover:bg-primary/90" onClick={focusRaiseTicket}>
                <Plus className="w-4 h-4 mr-1.5" /> Create support ticket
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FAQ */}
        <TabsContent value="faq" className="mt-4">
          <Card>
            <CardHeader>
              <SectionHeader
                title="Frequently Asked Questions"
                description="Quick answers to common travel-agent questions"
              />
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {FAQS.map((f, i) => (
                  <AccordionItem key={i} value={`faq-${i}`}>
                    <AccordionTrigger className="text-sm text-left hover:no-underline">
                      {f.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                      {f.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HELP CENTER */}
        <TabsContent value="help" className="mt-4">
          <BrandHero
            title="Help Center"
            subtitle="Browse articles, guides & tutorials to master Travel Partner Pro"
            actions={
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
                <Input placeholder="Search articles..." className="pl-8 bg-white/15 border-white/20 text-white placeholder:text-white/60" />
              </div>
            }
            className="mb-4"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {HELP_CATEGORIES.map((c, i) => {
              const Icon = c.icon;
              return (
                <motion.div key={c.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="hover:border-primary/25 transition-all duration-200 cursor-pointer h-full group">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", c.color)}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold">{c.title}</h4>
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary transition-all" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{c.desc}</p>
                          <p className="text-[10px] text-muted-foreground mt-2">{c.articles} articles</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <Card className="mt-4">
            <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-3 justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 flex items-center justify-center">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Still need help?</p>
                  <p className="text-xs text-muted-foreground">Our support team is available 24/7</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={focusRaiseTicket}><MessageCircle className="w-4 h-4 mr-1.5" /> Create Ticket</Button>
                <Button className="bg-primary hover:bg-primary/90" onClick={() => setRaiseOpen(true)}><Plus className="w-4 h-4 mr-1.5" /> Raise Ticket</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RaiseTicketDialog open={raiseOpen} onOpenChange={setRaiseOpen} onCreated={loadTickets} />
      <TicketDetailSheet
        ticket={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={(updated) => {
          setSelected(updated);
          setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        }}
      />
    </PageShell>
  );
}

function TicketDetailSheet({
  ticket,
  open,
  onOpenChange,
  onUpdated,
}: {
  ticket: SupportTicketApi | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated: (t: SupportTicketApi) => void;
}) {
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages: SupportTicketMessageApi[] = ticket?.messages || [];

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [open, messages.length]);

  if (!ticket) return null;

  const sendReply = async () => {
    const text = reply.trim();
    if (!text) return;
    setSending(true);
    try {
      const { message } = await api.postSupportMessage(ticket.id, { message: text });
      const msg = message as SupportTicketMessageApi;
      const next: SupportTicketApi = {
        ...ticket,
        status: ticket.status === "Open" ? "In Progress" : ticket.status,
        messages: [...(ticket.messages || []), msg],
      };
      onUpdated(next);
      setReply("");
      toast({ title: "Reply sent" });
    } catch (e) {
      toast({
        title: "Failed to send",
        description: e instanceof Error ? e.message : "Could not post message",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="border-b px-4 py-4 text-left">
          <SheetTitle className="font-mono text-base">{ticket.ticketId}</SheetTitle>
          <SheetDescription className="space-y-1">
            <span className="block text-foreground font-medium">{ticket.subject}</span>
            <span className="flex flex-wrap gap-2 items-center">
              <StatusBadge status={ticket.status} />
              <Badge variant="outline" className="text-[10px]">{ticket.priority}</Badge>
              <span className="text-xs">{ticket.department}</span>
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 py-3 border-b bg-muted/30 text-xs space-y-1">
          <p><span className="text-muted-foreground">Customer:</span> {ticket.customerName}</p>
          <p className="text-muted-foreground leading-relaxed">{ticket.description}</p>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin p-4 space-y-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No replies yet — send the first message.</p>
          ) : messages.map((m) => {
            const mine = user?.email && m.sender === user.email;
            return (
              <div key={m.id} className={cn("max-w-[90%] space-y-1", mine ? "ml-auto text-right" : "")}>
                <div className={cn(
                  "rounded-2xl px-3 py-2 text-sm inline-block text-left",
                  mine ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm",
                )}>
                  {m.message}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {m.sender} · {new Date(m.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            );
          })}
        </div>

        <div className="border-t p-3 space-y-2">
          <Textarea
            placeholder="Write a reply…"
            rows={3}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <div className="flex justify-end">
            <Button onClick={sendReply} disabled={sending || !reply.trim()} className="bg-primary hover:bg-primary/90">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1.5" /> Send Reply</>}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RaiseTicketDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [operationsType, setOperationsType] = useState<OperationsTypeValue>("general_inquiry");
  const [deliveryType, setDeliveryType] = useState<DeliveryTypeValue>("remote");
  const [scheduledAt, setScheduledAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setSubject("");
    setDescription("");
    setPriority("Medium");
    setOperationsType("general_inquiry");
    setDeliveryType("remote");
    setScheduledAt("");
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      toast({ title: "Missing fields", description: "Subject and description are required.", variant: "destructive" });
      return;
    }
    if (deliveryType === "scheduled" && !scheduledAt) {
      toast({ title: "Schedule required", description: "Pick a date/time for scheduled delivery.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { ticket } = await api.createSupportTicket({
        subject: subject.trim(),
        description: description.trim(),
        priority,
        operationsType,
        deliveryType,
        scheduledAt: deliveryType === "scheduled" ? new Date(scheduledAt).toISOString() : undefined,
        customerName: user?.name || "Support User",
        customerId: user?.id,
      });
      toast({
        title: "Ticket raised",
        description: `${ticket.ticketId} routed to ${ticket.department}. We'll respond soon.`,
      });
      resetForm();
      onOpenChange(false);
      onCreated();
    } catch {
      toast({ title: "Failed to create ticket", description: "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Raise Support Ticket</DialogTitle>
          <DialogDescription>
            Choose operations type (which team handles it) and delivery type (how it will be fulfilled).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input placeholder="Brief summary of the issue" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Operations Type</Label>
            <Select value={operationsType} onValueChange={(v) => setOperationsType(v as OperationsTypeValue)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {OPERATIONS_TYPES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {purposeForOperationsType(operationsType)} · Routed to <span className="font-medium">{departmentForOperationsType(operationsType)}</span>
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Delivery Type</Label>
            <Select value={deliveryType} onValueChange={(v) => setDeliveryType(v as DeliveryTypeValue)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DELIVERY_TYPES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{meaningForDeliveryType(deliveryType)}</p>
          </div>
          {deliveryType === "scheduled" && (
            <div className="space-y-1.5">
              <Label>Scheduled Date & Time</Label>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Urgent", "High", "Medium", "Low"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="Provide details — booking ID, customer name, what happened, expected resolution..."
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} className="bg-primary hover:bg-primary/90" disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
