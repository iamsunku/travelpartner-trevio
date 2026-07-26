"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Plus, Search, Send, MessageCircle, Plane, CreditCard,
  RefreshCw, FileText, User, Headphones, Bot, ArrowRight, CheckCircle2, Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
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
  PageShell, PageHeader, MetricCard, SectionHeader, BrandHero, StatusBadge, initials, avatarGradient,
} from "@/components/shared/ui-helpers";
import { cn } from "@/lib/utils";

type Ticket = {
  id: string;
  subject: string;
  customer: string;
  priority: "Urgent" | "High" | "Medium" | "Low";
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  createdAt: string;
  assignedTo: string;
  category: string;
};

const TICKETS: Ticket[] = [
  { id: "TK-3402", subject: "Refund not received for cancelled flight", customer: "Karthik Venkat", priority: "Urgent", status: "Open", createdAt: "2025-01-20 14:32", assignedTo: "Nikhil Joshi", category: "Refunds" },
  { id: "TK-3401", subject: "Unable to download e-ticket for BK-8849", customer: "Kavya Reddy", priority: "High", status: "In Progress", createdAt: "2025-01-20 12:18", assignedTo: "Nikhil Joshi", category: "Booking" },
  { id: "TK-3398", subject: "Holiday package itinerary not loading", customer: "Meera Iyer", priority: "High", status: "In Progress", createdAt: "2025-01-19 18:45", assignedTo: "Aisha Khan", category: "Booking" },
  { id: "TK-3395", subject: "Wallet balance mismatch after refund", customer: "TechCorp India", priority: "Medium", status: "Open", createdAt: "2025-01-19 16:02", assignedTo: "Vikram Iyer", category: "Payments" },
  { id: "TK-3390", subject: "Hotel booking shows wrong check-in date", customer: "Rohit Gupta", priority: "High", status: "Resolved", createdAt: "2025-01-19 11:30", assignedTo: "Sneha Reddy", category: "Booking" },
  { id: "TK-3385", subject: "GST invoice not generated for January", customer: "TechCorp India", priority: "Medium", status: "Resolved", createdAt: "2025-01-18 09:15", assignedTo: "Vikram Iyer", category: "Payments" },
  { id: "TK-3380", subject: "Cannot add infant to existing booking", customer: "Anjali Desai", priority: "Low", status: "Closed", createdAt: "2025-01-17 14:50", assignedTo: "Sneha Reddy", category: "Booking" },
  { id: "TK-3372", subject: "Razorpay payment failed but amount debited", customer: "Imran Khan", priority: "Urgent", status: "Open", createdAt: "2025-01-16 19:22", assignedTo: "Vikram Iyer", category: "Payments" },
];

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

type ChatMsg = { id: number; sender: "user" | "agent"; text: string; time: string };

const INITIAL_CHAT: ChatMsg[] = [
  { id: 1, sender: "agent", text: "Hi! Welcome to Travel Partner Pro Support. How can I help you today?", time: "10:24 AM" },
  { id: 2, sender: "user", text: "Hi, I have a question about a refund for booking BK-8848", time: "10:25 AM" },
  { id: 3, sender: "agent", text: "Sure! Let me pull up that booking for you. The refund of ₹42,000 for Nisha Agarwal's CCU→BKK flight was initiated on Jan 12. Standard processing time is 5-7 business days.", time: "10:25 AM" },
  { id: 4, sender: "user", text: "It's been 8 days and the customer hasn't received it yet", time: "10:26 AM" },
  { id: 5, sender: "agent", text: "I understand the concern. Let me escalate this with Razorpay immediately. I'll also create a priority ticket and have our finance team follow up within 2 hours.", time: "10:27 AM" },
];

const AGENT_REPLIES = [
  "Thanks for the details. Let me check that for you right away.",
  "I've created ticket TK-3405 and assigned it to our finance team. They'll respond within 2 hours.",
  "Could you please share the customer's registered email ID so I can verify?",
  "I see the issue — the refund was held up due to a bank holiday. It should reflect by tomorrow EOD.",
  "Is there anything else I can help you with today?",
  "Perfect! I've noted this on the ticket. You'll receive an SMS update once resolved.",
];

export function SupportView() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [raiseOpen, setRaiseOpen] = useState(false);

  const filteredTickets = TICKETS.filter((t) => {
    if (statusFilter !== "All" && t.status !== statusFilter) return false;
    if (search && !`${t.id} ${t.subject} ${t.customer}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <PageShell>
      <PageHeader
        title="Support"
        subtitle="Tickets, live chat, FAQs & help center"
      />

      <Tabs defaultValue="tickets">
        <TabsList className="w-full sm:w-auto overflow-x-auto bg-muted/60">
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="chat">Live Chat</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="help">Help Center</TabsTrigger>
        </TabsList>

        {/* TICKETS */}
        <TabsContent value="tickets" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard icon={MessageCircle} label="Open Tickets" value={String(TICKETS.filter((t) => t.status === "Open").length)} color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" index={0} />
            <MetricCard icon={RefreshCw} label="In Progress" value={String(TICKETS.filter((t) => t.status === "In Progress").length)} color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" index={1} />
            <MetricCard icon={CheckCircle2} label="Resolved" value={String(TICKETS.filter((t) => t.status === "Resolved").length)} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" index={2} />
            <MetricCard icon={Clock} label="Avg Response" value="1.4h" color="bg-primary/10 text-primary dark:bg-primary/15 dark:text-brand-teal" index={3} />
          </div>

          <Card>
            <CardContent className="p-3">
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search tickets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["All", "Open", "In Progress", "Resolved", "Closed"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={() => setRaiseOpen(true)} className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-1.5" /> Raise Ticket
                </Button>
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
                      <TableHead className="min-w-[200px]">Subject</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTickets.map((t) => (
                      <TableRow key={t.id} className="hover:bg-muted/40">
                        <TableCell className="font-mono text-xs font-medium">{t.id}</TableCell>
                        <TableCell>
                          <p className="text-sm font-medium line-clamp-1">{t.subject}</p>
                        </TableCell>
                        <TableCell className="text-sm">{t.customer}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{t.category}</Badge></TableCell>
                        <TableCell>
                          <span className={cn("inline-flex items-center gap-1 text-xs font-medium",
                            t.priority === "Urgent" ? "text-rose-600" :
                            t.priority === "High" ? "text-amber-600" :
                            t.priority === "Medium" ? "text-sky-600" : "text-slate-500")}>
                            <span className={cn("w-1.5 h-1.5 rounded-full",
                              t.priority === "Urgent" ? "bg-rose-500" :
                              t.priority === "High" ? "bg-amber-500" :
                              t.priority === "Medium" ? "bg-sky-500" : "bg-slate-400")} />
                            {t.priority}
                          </span>
                        </TableCell>
                        <TableCell><StatusBadge status={t.status} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.assignedTo}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.createdAt}</TableCell>
                      </TableRow>
                    ))}
                    {filteredTickets.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-sm text-muted-foreground">No tickets found.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LIVE CHAT */}
        <TabsContent value="chat" className="mt-4">
          <LiveChat />
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
                <Button variant="outline"><MessageCircle className="w-4 h-4 mr-1.5" /> Live Chat</Button>
                <Button className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-1.5" /> Raise Ticket</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RaiseTicketDialog open={raiseOpen} onOpenChange={setRaiseOpen} />
    </PageShell>
  );
}

function LiveChat() {
  const [messages, setMessages] = useState<ChatMsg[]>(INITIAL_CHAT);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const now = () => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const userMsg: ChatMsg = { id: Date.now(), sender: "user", text, time: now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const reply = AGENT_REPLIES[Math.floor(Math.random() * AGENT_REPLIES.length)];
      setMessages((prev) => [...prev, { id: Date.now() + 1, sender: "agent", text: reply, time: now() }]);
      setTyping(false);
    }, 1400);
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col h-[600px]">
        <div className="flex items-center justify-between p-3 border-b border-border bg-gradient-to-r from-brand-blue via-primary to-brand-teal text-white">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Avatar className="w-9 h-9 ring-2 ring-white/30">
                <AvatarFallback className="bg-white/20 text-white">
                  <Bot className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
            </div>
            <div>
              <p className="text-sm font-semibold">Travel Partner Support</p>
              <p className="text-[10px] text-white/75">Online · Avg reply 2 min</p>
            </div>
          </div>
          <Badge className="bg-white/15 text-white border-0 hover:bg-white/20">Live</Badge>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin p-4 space-y-3 bg-muted/30">
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("flex gap-2 max-w-[80%]", m.sender === "user" ? "ml-auto flex-row-reverse" : "")}
            >
              {m.sender === "agent" && (
                <Avatar className="w-7 h-7 shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-brand-blue to-brand-teal text-white">
                    <Bot className="w-3.5 h-3.5" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div>
                <div className={cn(
                  "rounded-2xl px-3 py-2 text-sm",
                  m.sender === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-card border border-border rounded-tl-sm",
                )}>
                  {m.text}
                </div>
                <p className={cn("text-[10px] text-muted-foreground mt-0.5", m.sender === "user" ? "text-right" : "")}>{m.time}</p>
              </div>
            </motion.div>
          ))}
          {typing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 max-w-[80%]">
              <Avatar className="w-7 h-7 shrink-0">
                <AvatarFallback className="bg-gradient-to-br from-brand-blue to-brand-teal text-white">
                  <Bot className="w-3.5 h-3.5" />
                </AvatarFallback>
              </Avatar>
              <div className="rounded-2xl rounded-tl-sm px-3 py-2.5 bg-card border border-border">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border p-3 bg-card">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              className="flex-1"
            />
            <Button onClick={send} className="bg-primary hover:bg-primary/90" size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </Card>
  );
}

function RaiseTicketDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const handleSubmit = () => {
    toast({ title: "Ticket raised", description: "Your ticket has been created. We'll respond within 2 hours." });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Raise Support Ticket</DialogTitle>
          <DialogDescription>Describe your issue and our team will get back to you.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input placeholder="Brief summary of the issue" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select defaultValue="Booking">
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Booking", "Payments", "Refunds", "Account", "Technical"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select defaultValue="High">
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Urgent", "High", "Medium", "Low"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea placeholder="Provide details — booking ID, customer name, what happened, expected resolution..." rows={4} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} className="bg-primary hover:bg-primary/90">Submit Ticket</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
