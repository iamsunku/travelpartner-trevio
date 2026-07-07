"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Plus, Image as ImageIcon, Tag, FileText, Star, HelpCircle, Search, Globe,
  MoreHorizontal, Pencil, Trash2, Eye, ArrowUp, ArrowDown, Check, FileCode, Link2,
} from "lucide-react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, StatusBadge, initials, avatarGradient } from "@/components/shared/ui-helpers";
import { cn } from "@/lib/utils";

interface Banner {
  id: string;
  title: string;
  position: "Home" | "Flight" | "Hotel";
  order: number;
  active: boolean;
  gradient: string;
}
const BANNERS_INIT: Banner[] = [
  { id: "bn-1", title: "Republic Day Mega Sale — Up to 25% off flights", position: "Home", order: 1, active: true, gradient: "from-teal-500 via-emerald-500 to-cyan-600" },
  { id: "bn-2", title: "Bali Bliss Honeymoon — Save ₹15,000", position: "Home", order: 2, active: true, gradient: "from-amber-500 via-orange-500 to-rose-500" },
  { id: "bn-3", title: "Fly Domestic, Earn 2X Loyalty Points", position: "Flight", order: 1, active: true, gradient: "from-violet-500 via-purple-500 to-fuchsia-600" },
  { id: "bn-4", title: "Luxury Stays from ₹3,200/night", position: "Hotel", order: 1, active: true, gradient: "from-cyan-500 via-teal-500 to-emerald-600" },
  { id: "bn-5", title: "Europe Early Bird — 20% Off", position: "Home", order: 3, active: false, gradient: "from-rose-500 via-pink-500 to-orange-500" },
];

interface Offer {
  id: string;
  title: string;
  code: string;
  discount: string;
  validTill: string;
  status: "Active" | "Expired";
  gradient: string;
}
const OFFERS: Offer[] = [
  { id: "of-1", title: "First Booking Bonus", code: "WELCOME500", discount: "₹500 OFF", validTill: "2025-03-31", status: "Active", gradient: "from-teal-500 to-emerald-600" },
  { id: "of-2", title: "Refer & Earn", code: "REFER1000", discount: "₹1,000 CASHBACK", validTill: "2025-12-31", status: "Active", gradient: "from-amber-500 to-orange-600" },
  { id: "of-3", title: "App-Only Flash Sale", code: "APP15", discount: "15% OFF", validTill: "2025-02-15", status: "Active", gradient: "from-violet-500 to-purple-600" },
  { id: "of-4", title: "Corporate Bulk Discount", code: "CORP25", discount: "25% OFF", validTill: "2024-12-31", status: "Expired", gradient: "from-rose-500 to-pink-600" },
];

interface BlogPost {
  id: string;
  title: string;
  author: string;
  category: string;
  status: "Published" | "Draft";
  date: string;
  views: number;
}
const BLOGS: BlogPost[] = [
  { id: "bl-1", title: "Top 10 Honeymoon Destinations in 2025", author: "Sneha Reddy", category: "Honeymoon", status: "Published", date: "2025-01-18", views: 12480 },
  { id: "bl-2", title: "Visa-Free Countries for Indians in 2025", author: "Aisha Khan", category: "Visa Guide", status: "Published", date: "2025-01-15", views: 28420 },
  { id: "bl-3", title: "How to Pack Light for a 7-Day Europe Trip", author: "Priya Nair", category: "Travel Tips", status: "Published", date: "2025-01-10", views: 8420 },
  { id: "bl-4", title: "Best Time to Book Flights for Maximum Savings", author: "Rahul Khanna", category: "Flight Tips", status: "Draft", date: "2025-01-20", views: 0 },
  { id: "bl-5", title: "Bali vs Maldives — Which is Better for Couples?", author: "Sneha Reddy", category: "Honeymoon", status: "Published", date: "2025-01-05", views: 18920 },
  { id: "bl-6", title: "Hidden Gems in North East India", author: "Deepa Rao", category: "Domestic", status: "Draft", date: "2025-01-19", views: 0 },
];

interface Testimonial {
  id: string;
  name: string;
  rating: number;
  text: string;
  status: "Published" | "Pending";
  trip: string;
}
const TESTIMONIALS_INIT: Testimonial[] = [
  { id: "ts-1", name: "Karthik Venkat", rating: 5, text: "Wanderlust Travels planned our Bali honeymoon flawlessly. Every detail was perfect — private villa, candle-lit dinners, and seamless transfers!", status: "Published", trip: "Bali Bliss - 6N/7D" },
  { id: "ts-2", name: "Rohit Gupta", rating: 5, text: "TechCorp India uses them for all corporate travel. The dashboard makes approvals and reporting effortless.", status: "Published", trip: "Corporate Travel" },
  { id: "ts-3", name: "Anjali Desai", rating: 4, text: "Great Goa package. Beach resort was beautiful but check-in took longer than expected. Overall a wonderful trip.", status: "Published", trip: "Goa Beach Party - 3N/4D" },
  { id: "ts-4", name: "Imran Khan", rating: 5, text: "Got my Schengen visa processed in just 12 days! Highly recommend their visa service.", status: "Pending", trip: "Schengen Visa" },
  { id: "ts-5", name: "Meera Iyer", rating: 5, text: "The holiday expert understood our family's needs and crafted the perfect Europe itinerary within budget.", status: "Pending", trip: "Europe Explorer - 11N/12D" },
];

interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string;
}
const FAQS_INIT: Faq[] = [
  { id: "fq-1", question: "How do I cancel a booking?", answer: "You can cancel any booking from your dashboard under My Bookings. Cancellation charges depend on the airline/hotel policy and time of cancellation. Refunds are processed to the original payment method within 7-10 business days.", category: "Bookings" },
  { id: "fq-2", question: "What is the refund policy?", answer: "Refunds for cancellations are processed as per the supplier's policy. For flights, cancellation within 24 hours of booking is fully refundable. Hotel refunds depend on the property's cancellation window.", category: "Payments" },
  { id: "fq-3", question: "Do I need a visa for international travel?", answer: "Visa requirements vary by destination and your nationality. Our visa experts can assist with documentation and processing for 80+ countries. Contact us at visas@travelpartner.pro.", category: "Visa" },
  { id: "fq-4", question: "How do I use my wallet balance?", answer: "Wallet balance can be used as full or partial payment during checkout. Select 'Wallet' as the payment method on the payment page. Wallet top-ups are instant via UPI, cards, or net banking.", category: "Payments" },
  { id: "fq-5", question: "Can I modify a booking after confirmation?", answer: "Yes, most bookings can be modified. Date changes for flights may attract airline change fees plus our service charge. Hotel date changes depend on availability and the property's policy.", category: "Bookings" },
];

const SEO_PAGES = [
  { id: "home", name: "Homepage", title: "Travel Partner Pro — Flights, Hotels, Holidays, Visa & More", description: "Book domestic & international flights, hotels, holiday packages, bus, train tickets & visa services with best price guarantee. Trusted by 1M+ travelers." },
  { id: "flights", name: "Flights", title: "Cheap Flight Tickets Booking Online — Best Fares | Travel Partner Pro", description: "Search & book cheap domestic and international flight tickets. Compare fares across 700+ airlines. Instant ticketing with best price guarantee." },
  { id: "hotels", name: "Hotels", title: "Hotel Booking Online — 250K+ Hotels at Best Prices", description: "Book hotels online at the best prices. Choose from luxury resorts to budget stays across 12,000+ destinations. Free cancellation available." },
  { id: "holidays", name: "Holiday Packages", title: "Holiday Tour Packages — Domestic & International Trips", description: "Customized domestic & international holiday packages. Honeymoon, family, group & corporate tours with flights, hotels, transfers included." },
];

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("w-3.5 h-3.5", i <= rating ? "fill-amber-400 text-amber-400" : "fill-muted text-muted-foreground/40")} />
      ))}
    </div>
  );
}

export function CmsView() {
  const { toast } = useToast();
  const [tab, setTab] = useState("banners");
  const [banners, setBanners] = useState<Banner[]>(BANNERS_INIT);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(TESTIMONIALS_INIT);
  const [faqs, setFaqs] = useState<Faq[]>(FAQS_INIT);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [blogOpen, setBlogOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<Faq | null>(null);
  const [bannerForm, setBannerForm] = useState({ title: "", position: "Home" as Banner["position"] });
  const [blogForm, setBlogForm] = useState({ title: "", author: "", category: "Travel Tips" });
  const [faqForm, setFaqForm] = useState({ question: "", answer: "", category: "Bookings" });
  const [seoActive, setSeoActive] = useState("home");
  const [seoData, setSeoData] = useState(SEO_PAGES);
  const [blogSearch, setBlogSearch] = useState("");

  function addBanner() {
    if (!bannerForm.title) {
      toast({ title: "Missing title", description: "Banner title required.", variant: "destructive" });
      return;
    }
    const newBanner: Banner = {
      id: `bn-${banners.length + 1}`, title: bannerForm.title, position: bannerForm.position,
      order: banners.filter((b) => b.position === bannerForm.position).length + 1,
      active: true,
      gradient: ["from-teal-500 to-emerald-600", "from-amber-500 to-orange-600", "from-violet-500 to-purple-600", "from-rose-500 to-pink-600"][banners.length % 4],
    };
    setBanners([...banners, newBanner]);
    setBannerOpen(false);
    setBannerForm({ title: "", position: "Home" });
    toast({ title: "Banner added", description: newBanner.title });
  }

  function moveBanner(id: string, dir: "up" | "down") {
    setBanners((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swapWith = dir === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= next.length) return prev;
      [next[idx].order, next[swapWith].order] = [next[swapWith].order, next[idx].order];
      return [...next].sort((a, b) => a.order - b.order);
    });
  }

  function toggleBanner(id: string) {
    setBanners((prev) => prev.map((b) => b.id === id ? { ...b, active: !b.active } : b));
  }

  function addBlog() {
    if (!blogForm.title || !blogForm.author) {
      toast({ title: "Missing fields", description: "Title and author required.", variant: "destructive" });
      return;
    }
    toast({ title: "Blog post created", description: blogForm.title });
    setBlogOpen(false);
    setBlogForm({ title: "", author: "", category: "Travel Tips" });
  }

  function saveFaq() {
    if (!faqForm.question || !faqForm.answer) {
      toast({ title: "Missing fields", description: "Question and answer required.", variant: "destructive" });
      return;
    }
    if (editingFaq) {
      setFaqs((prev) => prev.map((f) => f.id === editingFaq.id ? { ...f, ...faqForm } : f));
      toast({ title: "FAQ updated", description: faqForm.question });
    } else {
      setFaqs([...faqs, { id: `fq-${faqs.length + 1}`, ...faqForm }]);
      toast({ title: "FAQ added", description: faqForm.question });
    }
    setFaqOpen(false);
    setEditingFaq(null);
    setFaqForm({ question: "", answer: "", category: "Bookings" });
  }

  function toggleTestimonial(id: string) {
    setTestimonials((prev) => prev.map((t) => t.id === id ? { ...t, status: t.status === "Published" ? "Pending" : "Published" } : t));
  }

  const filteredBlogs = BLOGS.filter((b) =>
    b.title.toLowerCase().includes(blogSearch.toLowerCase()) ||
    b.author.toLowerCase().includes(blogSearch.toLowerCase()) ||
    b.category.toLowerCase().includes(blogSearch.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Content Management" subtitle="Banners, offers, blogs, testimonials, FAQ and SEO" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="banners" className="flex items-center gap-1.5"><ImageIcon className="w-4 h-4" /> Banners</TabsTrigger>
          <TabsTrigger value="offers" className="flex items-center gap-1.5"><Tag className="w-4 h-4" /> Offers</TabsTrigger>
          <TabsTrigger value="blogs" className="flex items-center gap-1.5"><FileText className="w-4 h-4" /> Blogs</TabsTrigger>
          <TabsTrigger value="testimonials" className="flex items-center gap-1.5"><Star className="w-4 h-4" /> Testimonials</TabsTrigger>
          <TabsTrigger value="faq" className="flex items-center gap-1.5"><HelpCircle className="w-4 h-4" /> FAQ</TabsTrigger>
          <TabsTrigger value="seo" className="flex items-center gap-1.5"><Globe className="w-4 h-4" /> SEO</TabsTrigger>
        </TabsList>

        {/* BANNERS */}
        <TabsContent value="banners" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{banners.length} banners · {banners.filter((b) => b.active).length} live</p>
            <Button className="bg-gradient-to-r from-teal-600 to-emerald-600" onClick={() => setBannerOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Banner
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {banners.map((b) => (
              <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className={cn("overflow-hidden hover:shadow-md transition-shadow", !b.active && "opacity-70")}>
                  <div className={cn("relative h-20 bg-gradient-to-r p-3 flex items-center justify-between", b.gradient)}>
                    <div className="absolute inset-0 bg-black/15" />
                    <div className="relative z-10">
                      <Badge variant="outline" className="bg-white/20 text-white border-0 backdrop-blur-sm mb-1">{b.position} · #{b.order}</Badge>
                      <p className="text-white font-semibold text-sm drop-shadow">{b.title}</p>
                    </div>
                  </div>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch checked={b.active} onCheckedChange={() => toggleBanner(b.id)} />
                      <StatusBadge status={b.active ? "Active" : "Pending"} className="text-[10px] px-1.5 py-0" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveBanner(b.id, "up")}><ArrowUp className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveBanner(b.id, "down")}><ArrowDown className="w-3.5 h-3.5" /></Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem onClick={() => toast({ title: "Edit banner", description: b.title })}><Pencil className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-rose-600" onClick={() => { setBanners((prev) => prev.filter((x) => x.id !== b.id)); toast({ title: "Banner deleted", description: b.title, variant: "destructive" }); }}>
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* OFFERS */}
        <TabsContent value="offers" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{OFFERS.length} offers · {OFFERS.filter((o) => o.status === "Active").length} active</p>
            <Button className="bg-gradient-to-r from-teal-600 to-emerald-600" onClick={() => toast({ title: "New offer", description: "Opening offer designer" })}>
              <Plus className="w-4 h-4 mr-1.5" /> New Offer
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {OFFERS.map((o) => (
              <motion.div key={o.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }}>
                <Card className={cn("overflow-hidden hover:shadow-md transition-shadow", o.status !== "Active" && "opacity-70")}>
                  <div className={cn("h-20 bg-gradient-to-br flex items-center justify-center text-white", o.gradient)}>
                    <p className="text-lg font-bold drop-shadow">{o.discount}</p>
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-semibold text-sm">{o.title}</h3>
                    <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted mt-1 inline-block">{o.code}</code>
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Valid: {o.validTill}</span>
                      <StatusBadge status={o.status} className="text-[10px] px-1.5 py-0" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* BLOGS */}
        <TabsContent value="blogs" className="mt-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search posts..." className="pl-8" value={blogSearch} onChange={(e) => setBlogSearch(e.target.value)} />
            </div>
            <Button className="bg-gradient-to-r from-teal-600 to-emerald-600" onClick={() => setBlogOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> New Post
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[28rem] overflow-auto scroll-thin">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBlogs.map((b) => (
                      <TableRow key={b.id} className="hover:bg-muted/40">
                        <TableCell className="font-medium max-w-xs truncate">{b.title}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{b.author}</TableCell>
                        <TableCell><Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">{b.category}</Badge></TableCell>
                        <TableCell><StatusBadge status={b.status} className="text-[10px] px-1.5 py-0" /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{b.date}</TableCell>
                        <TableCell className="text-right tabular-nums">{b.views.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => toast({ title: "View post", description: b.title })}><Eye className="w-4 h-4 mr-2" /> View</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toast({ title: "Edit post", description: b.title })}><Pencil className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-rose-600" onClick={() => toast({ title: "Post deleted", description: b.title, variant: "destructive" })}>
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TESTIMONIALS */}
        <TabsContent value="testimonials" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">{testimonials.length} testimonials · {testimonials.filter((t) => t.status === "Published").length} published</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {testimonials.map((t) => (
              <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }}>
                <Card className="h-full hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex flex-col h-full">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="w-9 h-9 border">
                          <AvatarFallback className={cn("bg-gradient-to-br text-white text-xs font-semibold", avatarGradient(t.name))}>
                            {initials(t.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-semibold">{t.name}</p>
                          <p className="text-[10px] text-muted-foreground">{t.trip}</p>
                        </div>
                      </div>
                      <Stars rating={t.rating} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 leading-relaxed flex-1">"{t.text}"</p>
                    <Separator className="my-3" />
                    <div className="flex items-center justify-between">
                      <StatusBadge status={t.status} className="text-[10px] px-1.5 py-0" />
                      <div className="flex items-center gap-1.5">
                        <Switch checked={t.status === "Published"} onCheckedChange={() => toggleTestimonial(t.id)} />
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600" onClick={() => { setTestimonials((prev) => prev.filter((x) => x.id !== t.id)); toast({ title: "Testimonial deleted", variant: "destructive" }); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* FAQ */}
        <TabsContent value="faq" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{faqs.length} FAQs across {new Set(faqs.map((f) => f.category)).size} categories</p>
            <Button className="bg-gradient-to-r from-teal-600 to-emerald-600" onClick={() => { setEditingFaq(null); setFaqForm({ question: "", answer: "", category: "Bookings" }); setFaqOpen(true); }}>
              <Plus className="w-4 h-4 mr-1.5" /> Add FAQ
            </Button>
          </div>
          <Card>
            <CardContent className="p-4">
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((f) => (
                  <AccordionItem key={f.id} value={f.id} className="border-b last:border-0">
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-2 text-left flex-1">
                        <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200 text-[10px] px-1.5 py-0 shrink-0">{f.category}</Badge>
                        <span className="text-sm font-medium">{f.question}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-3">
                      {f.answer}
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditingFaq(f); setFaqForm({ question: f.question, answer: f.answer, category: f.category }); setFaqOpen(true); }}>
                          <Pencil className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-rose-600" onClick={() => { setFaqs((prev) => prev.filter((x) => x.id !== f.id)); toast({ title: "FAQ deleted", variant: "destructive" }); }}>
                          <Trash2 className="w-3 h-3 mr-1" /> Delete
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEO */}
        <TabsContent value="seo" className="mt-4 space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4 text-teal-600" /> Page Meta Configuration</CardTitle>
                <CardDescription className="text-xs">Manage title, description and keywords per page</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {SEO_PAGES.map((p) => (
                    <Button key={p.id} size="sm" variant={seoActive === p.id ? "default" : "outline"}
                      className={seoActive === p.id ? "bg-gradient-to-r from-teal-600 to-emerald-600" : ""}
                      onClick={() => setSeoActive(p.id)}>
                      {p.name}
                    </Button>
                  ))}
                </div>
                <Separator />
                {seoData.filter((p) => p.id === seoActive).map((p) => (
                  <div key={p.id} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Meta Title <span className="text-[10px] text-muted-foreground">({p.title.length}/60 chars)</span></Label>
                      <Input value={p.title} onChange={(e) => setSeoData((prev) => prev.map((x) => x.id === p.id ? { ...x, title: e.target.value } : x))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Meta Description <span className="text-[10px] text-muted-foreground">({p.description.length}/160 chars)</span></Label>
                      <Textarea rows={3} value={p.description} onChange={(e) => setSeoData((prev) => prev.map((x) => x.id === p.id ? { ...x, description: e.target.value } : x))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Keywords (comma-separated)</Label>
                      <Input defaultValue="travel, flights, hotels, holiday packages, visa, bus booking, train tickets" />
                    </div>
                    <div className="flex gap-2">
                      <Button className="bg-gradient-to-r from-teal-600 to-emerald-600" onClick={() => toast({ title: "SEO saved", description: `${p.name} meta updated.` })}>
                        <Check className="w-4 h-4 mr-1.5" /> Save Changes
                      </Button>
                      <Button variant="outline" onClick={() => toast({ title: "Preview", description: `Opening Google preview for ${p.name}` })}>
                        <Eye className="w-4 h-4 mr-1.5" /> Preview
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Site Indexing</CardTitle>
                <CardDescription className="text-xs">Sitemap & robots.txt status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-teal-600" />
                      <div>
                        <p className="text-xs font-semibold">sitemap.xml</p>
                        <p className="text-[10px] text-muted-foreground">42 URLs · last built 2h ago</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200"><Check className="w-3 h-3 mr-1" /> Live</Badge>
                  </div>
                  <Button size="sm" variant="outline" className="w-full mt-2 text-xs" onClick={() => toast({ title: "Sitemap rebuilt", description: "42 URLs indexed." })}>
                    <Link2 className="w-3 h-3 mr-1" /> Rebuild Sitemap
                  </Button>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-amber-600" />
                      <div>
                        <p className="text-xs font-semibold">robots.txt</p>
                        <p className="text-[10px] text-muted-foreground">Allow all · sitemap referenced</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200"><Check className="w-3 h-3 mr-1" /> Live</Badge>
                  </div>
                  <Button size="sm" variant="outline" className="w-full mt-2 text-xs" onClick={() => toast({ title: "robots.txt", description: "Opening editor" })}>
                    <Pencil className="w-3 h-3 mr-1" /> Edit robots.txt
                  </Button>
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-semibold">Search Engine Status</p>
                  {[
                    { name: "Google", status: "Indexed · 42 pages", ok: true },
                    { name: "Bing", status: "Indexed · 38 pages", ok: true },
                    { name: "Yandex", status: "Pending submission", ok: false },
                  ].map((s) => (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <span className="font-medium">{s.name}</span>
                      <span className={cn("flex items-center gap-1", s.ok ? "text-emerald-600" : "text-amber-600")}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", s.ok ? "bg-emerald-500" : "bg-amber-500")} />
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Banner Dialog */}
      <Dialog open={bannerOpen} onOpenChange={setBannerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ImageIcon className="w-5 h-5 text-teal-600" /> Add Banner</DialogTitle>
            <DialogDescription>Create a new homepage or section banner.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bn-title">Banner Title</Label>
              <Input id="bn-title" placeholder="Sale title..." value={bannerForm.title} onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Position</Label>
              <Select value={bannerForm.position} onValueChange={(v) => setBannerForm({ ...bannerForm, position: v as Banner["position"] })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Home">Homepage</SelectItem>
                  <SelectItem value="Flight">Flight Listing</SelectItem>
                  <SelectItem value="Hotel">Hotel Listing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBannerOpen(false)}>Cancel</Button>
            <Button className="bg-gradient-to-r from-teal-600 to-emerald-600" onClick={addBanner}><Plus className="w-4 h-4 mr-1.5" /> Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blog Dialog */}
      <Dialog open={blogOpen} onOpenChange={setBlogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-teal-600" /> New Blog Post</DialogTitle>
            <DialogDescription>Draft a new article for the blog.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bl-title">Title</Label>
              <Input id="bl-title" placeholder="Post title..." value={blogForm.title} onChange={(e) => setBlogForm({ ...blogForm, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bl-author">Author</Label>
                <Input id="bl-author" placeholder="Author name" value={blogForm.author} onChange={(e) => setBlogForm({ ...blogForm, author: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={blogForm.category} onValueChange={(v) => setBlogForm({ ...blogForm, category: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Travel Tips">Travel Tips</SelectItem>
                    <SelectItem value="Honeymoon">Honeymoon</SelectItem>
                    <SelectItem value="Visa Guide">Visa Guide</SelectItem>
                    <SelectItem value="Flight Tips">Flight Tips</SelectItem>
                    <SelectItem value="Domestic">Domestic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bl-body">Body</Label>
              <Textarea id="bl-body" rows={4} placeholder="Write your post..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlogOpen(false)}>Cancel</Button>
            <Button className="bg-gradient-to-r from-teal-600 to-emerald-600" onClick={addBlog}><Plus className="w-4 h-4 mr-1.5" /> Create Post</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FAQ Dialog */}
      <Dialog open={faqOpen} onOpenChange={setFaqOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><HelpCircle className="w-5 h-5 text-teal-600" /> {editingFaq ? "Edit FAQ" : "Add FAQ"}</DialogTitle>
            <DialogDescription>{editingFaq ? "Update this FAQ entry." : "Create a new FAQ entry."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={faqForm.category} onValueChange={(v) => setFaqForm({ ...faqForm, category: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bookings">Bookings</SelectItem>
                  <SelectItem value="Payments">Payments</SelectItem>
                  <SelectItem value="Visa">Visa</SelectItem>
                  <SelectItem value="Account">Account</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fq-q">Question</Label>
              <Input id="fq-q" placeholder="Question..." value={faqForm.question} onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fq-a">Answer</Label>
              <Textarea id="fq-a" rows={4} placeholder="Answer..." value={faqForm.answer} onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFaqOpen(false)}>Cancel</Button>
            <Button className="bg-gradient-to-r from-teal-600 to-emerald-600" onClick={saveFaq}><Plus className="w-4 h-4 mr-1.5" /> {editingFaq ? "Save" : "Add FAQ"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
