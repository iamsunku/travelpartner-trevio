const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("tpp-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<T>;
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    await apiFetch<{ status: string }>("/api/health");
    return true;
  } catch {
    return false;
  }
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch<{ user: ApiUser; token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  forgotPassword: (email: string) =>
    apiFetch<{ ok: boolean; tempPassword?: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  getBookings: (params?: Record<string, string>) => {
    const q = params ? `?${new URLSearchParams(params)}` : "";
    return apiFetch<{ bookings: ApiBooking[]; total: number }>(`/api/bookings${q}`);
  },

  createBooking: (body: Record<string, unknown>) =>
    apiFetch<{ booking: ApiBooking }>("/api/bookings", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateBooking: (id: string, body: Record<string, unknown>) =>
    apiFetch<{ booking: ApiBooking }>(`/api/bookings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  getCustomers: () => apiFetch<{ customers: ApiCustomer[]; total: number }>("/api/customers"),

  createCustomer: (body: Record<string, unknown>) =>
    apiFetch<{ customer: ApiCustomer }>("/api/customers", { method: "POST", body: JSON.stringify(body) }),

  getAgencies: () => apiFetch<{ agencies: ApiAgency[]; total: number }>("/api/agencies"),

  getBranches: (agencyId?: string) => {
    const q = agencyId ? `?agencyId=${agencyId}` : "";
    return apiFetch<{ branches: ApiBranch[]; total: number }>(`/api/branches${q}`);
  },

  getEmployees: (agencyId?: string) => {
    const q = agencyId ? `?agencyId=${agencyId}` : "";
    return apiFetch<{ employees: ApiEmployee[]; total: number }>(`/api/employees${q}`);
  },

  createEmployee: (body: Record<string, unknown>) =>
    apiFetch<{ employee: ApiEmployee; tempPassword?: string }>("/api/employees", { method: "POST", body: JSON.stringify(body) }),

  getTasks: () => apiFetch<{ tasks: ApiTask[]; total: number }>("/api/tasks"),

  createTask: (body: Record<string, unknown>) =>
    apiFetch<{ task: ApiTask }>("/api/tasks", { method: "POST", body: JSON.stringify(body) }),

  updateTask: (id: string, body: Record<string, unknown>) =>
    apiFetch<{ task: ApiTask }>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  getAuditLogs: () => apiFetch<{ logs: ApiAuditLog[]; total: number }>("/api/audit-logs"),

  getReports: () =>
    apiFetch<{
      summary: { totalRevenue: number; totalCommission: number; totalBookings: number; confirmedBookings: number; successPayments: number };
      byService: { service: string; bookings: number; revenue: number }[];
      byPaymentMethod: { method: string; count: number }[];
    }>("/api/reports"),

  searchFlights: (origin: string, destination: string, count = 8) =>
    apiFetch<{ flights: ApiFlight[] }>(`/api/flights/search?origin=${origin}&destination=${destination}&count=${count}`),

  searchHotels: (city: string, count = 8) =>
    apiFetch<{ hotels: ApiHotel[] }>(`/api/hotels/search?city=${encodeURIComponent(city)}&count=${count}`),

  walletTransaction: (body: Record<string, unknown>) =>
    apiFetch<{ balance: number; transaction: ApiWalletTxn }>("/api/wallet", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getNotifications: () => apiFetch<{ notifications: ApiNotification[] }>("/api/notifications"),

  getWallet: (agencyId: string) =>
    apiFetch<{ balance: number; transactions: ApiWalletTxn[] }>(`/api/wallet?agencyId=${agencyId}`),

  getDashboard: () => apiFetch<{ stats: { bookings: number; agencies: number; customers: number; leads: number; payments: number } }>("/api/dashboard"),

  getLeads: () => apiFetch<{ leads: ApiLead[]; total: number }>("/api/leads"),

  createLead: (body: Record<string, unknown>) =>
    apiFetch<{ lead: ApiLead }>("/api/leads", { method: "POST", body: JSON.stringify(body) }),

  updateLeadStage: (id: string, stage: string) =>
    apiFetch<{ lead: ApiLead }>(`/api/leads/${id}`, { method: "PATCH", body: JSON.stringify({ stage }) }),

  getQuotations: () => apiFetch<{ quotations: ApiQuotation[]; total: number }>("/api/quotations"),

  createQuotation: (body: Record<string, unknown>) =>
    apiFetch<{ quotation: ApiQuotation }>("/api/quotations", { method: "POST", body: JSON.stringify(body) }),

  getPayments: () => apiFetch<{ payments: ApiPayment[]; total: number }>("/api/payments"),

  createPayment: (body: Record<string, unknown>) =>
    apiFetch<{ payment: ApiPayment }>("/api/payments", { method: "POST", body: JSON.stringify(body) }),

  markNotificationRead: (id: string) =>
    apiFetch<{ notification: ApiNotification }>(`/api/notifications/${id}/read`, { method: "PATCH" }),

  getMe: () => apiFetch<{ user: ApiUser }>("/api/auth/me"),

  updateQuotation: (id: string, body: Record<string, unknown>) =>
    apiFetch<{ quotation: ApiQuotation }>(`/api/quotations/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  updateCustomer: (id: string, body: Record<string, unknown>) =>
    apiFetch<{ customer: ApiCustomer }>(`/api/customers/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  deleteCustomer: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/customers/${id}`, { method: "DELETE" }),

  deleteBooking: (id: string) =>
    apiFetch<{ booking: ApiBooking }>(`/api/bookings/${id}`, { method: "DELETE" }),

  deleteTask: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/tasks/${id}`, { method: "DELETE" }),

  updateEmployee: (id: string, body: Record<string, unknown>) =>
    apiFetch<{ employee: ApiEmployee }>(`/api/employees/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  createBranch: (body: Record<string, unknown>) =>
    apiFetch<{ branch: ApiBranch }>("/api/branches", { method: "POST", body: JSON.stringify(body) }),

  updateBranch: (id: string, body: Record<string, unknown>) =>
    apiFetch<{ branch: ApiBranch }>(`/api/branches/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  createAgency: (body: Record<string, unknown>) =>
    apiFetch<{ agency: ApiAgency; tempPassword?: string }>("/api/agencies", { method: "POST", body: JSON.stringify(body) }),

  updateAgency: (id: string, body: Record<string, unknown>) =>
    apiFetch<{ agency: ApiAgency }>(`/api/agencies/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  getCommission: () =>
    apiFetch<ApiCommissionResponse>("/api/commission"),

  getFinance: () =>
    apiFetch<ApiFinanceResponse>("/api/finance"),

  getAnalyticsPlatform: (range: "monthly" | "yearly") =>
    apiFetch<ApiPlatformAnalytics>(`/api/analytics/platform?range=${range}`),

  getAnalyticsEmployees: (range: "monthly" | "yearly") =>
    apiFetch<ApiEmployeeAnalytics>(`/api/analytics/employees?range=${range}`),

  createRazorpayOrder: (amount: number) =>
    apiFetch<{ configured: boolean; orderId?: string; amount?: number; currency?: string; keyId?: string }>(
      "/api/payments/razorpay/order",
      { method: "POST", body: JSON.stringify({ amount }) }
    ),

  verifyRazorpayPayment: (orderId: string, paymentId: string, signature: string) =>
    apiFetch<{ verified: boolean }>("/api/payments/razorpay/verify", {
      method: "POST",
      body: JSON.stringify({ orderId, paymentId, signature }),
    }),

  // Phase 3 Endpoints

  getMarketingCampaigns: () => apiFetch<{ campaigns: any[] }>("/api/marketing/campaigns"),
  createMarketingCampaign: (body: any) => apiFetch<any>("/api/marketing/campaigns", { method: "POST", body: JSON.stringify(body) }),

  getCmsPages: () => apiFetch<{ pages: any[] }>("/api/cms/pages"),
  createCmsPage: (body: any) => apiFetch<any>("/api/cms/pages", { method: "POST", body: JSON.stringify(body) }),

  getApiKeys: () => apiFetch<{ keys: any[] }>("/api/management/keys"),
  createApiKey: (body: any) => apiFetch<any>("/api/management/keys", { method: "POST", body: JSON.stringify(body) }),

  getSupportTickets: () => apiFetch<{ tickets: any[] }>("/api/support/tickets"),
  createSupportTicket: (body: any) => apiFetch<any>("/api/support/tickets", { method: "POST", body: JSON.stringify(body) }),

  getSettings: () => apiFetch<any>("/api/settings"),
  updateSettings: (body: any) => apiFetch<any>("/api/settings", { method: "PUT", body: JSON.stringify(body) }),

  getMonitoringMetrics: () => apiFetch<any>("/api/monitoring/metrics"),

  checkIn: () => apiFetch<{ attendance: ApiAttendance }>("/api/attendance/check-in", { method: "POST", body: "{}" }),
  checkOut: () => apiFetch<{ attendance: ApiAttendance }>("/api/attendance/check-out", { method: "POST", body: "{}" }),
  getAttendance: (userId?: string) => {
    const q = userId ? `?userId=${userId}` : "";
    return apiFetch<{ attendance: ApiAttendance[]; total: number }>(`/api/attendance${q}`);
  },

  getLeaves: () => apiFetch<{ leaves: ApiLeave[]; total: number }>("/api/leaves"),
  createLeave: (body: Record<string, unknown>) =>
    apiFetch<{ leave: ApiLeave }>("/api/leaves", { method: "POST", body: JSON.stringify(body) }),
  updateLeaveStatus: (id: string, status: "Approved" | "Rejected") =>
    apiFetch<{ leave: ApiLeave }>(`/api/leaves/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
};


export interface ApiUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  designation?: string | null;
  agencyId?: string | null;
  branchId?: string | null;
  permissions?: string[] | null;
}

export interface ApiBooking {
  id: string;
  bookingRef: string;
  customerName: string;
  service: string;
  route: string;
  travelDate: string;
  amount: number;
  commission: number;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  agentName: string;
  agencyName: string;
  createdAt: string;
}

export interface ApiCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: string;
  tier: string;
  totalBookings: number;
  totalSpent: number;
  loyaltyPoints: number;
  passportNo?: string | null;
  visaStatus?: string | null;
  city?: string | null;
  createdAt: string;
}

export interface ApiAgency {
  id: string;
  name: string;
  owner: string;
  email: string;
  phone: string;
  plan: string;
  status: string;
  walletBalance: number;
  commissionEarned?: number;
  totalBookings?: number;
  monthlyRevenue?: number;
  apiAllocation?: { flights: number; hotels: number };
  branches?: number;
  employees?: number;
  createdAt?: string;
}

export interface ApiBranch {
  id: string;
  agencyId: string;
  name: string;
  manager: string;
  city: string;
  revenue: number;
  employees?: number;
}

export interface ApiEmployee {
  id: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  branch: string;
  branchId?: string | null;
  role: string;
  status: string;
  salary: number;
  incentives: number;
  target: number;
  achieved: number;
  attendance: number;
  joinDate: string;
  permissions?: string[] | null;
}

export interface ApiAttendance {
  id: string;
  userId: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  status: string;
  user?: { email: string; name: string } | null;
}

export interface ApiLeave {
  id: string;
  userId: string;
  userName: string;
  type: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: string;
  approvedByName?: string | null;
  createdAt: string;
}

export interface ApiTask {
  id: string;
  title: string;
  description?: string | null;
  assignedTo: string;
  assignedBy: string;
  priority: string;
  status: string;
  dueDate: string;
  relatedTo?: string | null;
  createdAt: string;
}

export interface ApiAuditLog {
  id: string;
  userName: string;
  action: string;
  module: string;
  ip?: string | null;
  details?: string | null;
  createdAt: string;
}

export interface ApiFlight {
  id: string;
  airline: string;
  airlineCode: string;
  flightNumber: string;
  origin: string;
  originCity: string;
  destination: string;
  destinationCity: string;
  departTime: string;
  arriveTime: string;
  duration: string;
  stops: number;
  price: number;
  currency: string;
  cabin: string;
  seatsLeft: number;
  refundable: boolean;
  aircraft: string;
  rating: number;
}

export interface ApiHotel {
  id: string;
  name: string;
  city: string;
  area: string;
  starRating: number;
  rating: number;
  reviews: number;
  pricePerNight: number;
  currency: string;
  originalPrice: number;
  amenities: string[];
  images: string[];
  distanceFromCenter: number;
  latitude: number;
  longitude: number;
  rooms: ApiRoomType[];
}

export interface ApiRoomType {
  id: string;
  name: string;
  description: string;
  price: number;
  maxGuests: number;
  beds: string;
  includesBreakfast: boolean;
  freeCancellation: boolean;
  refundable: boolean;
  roomsLeft: number;
}

export interface ApiNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  read: boolean;
  createdAt: string;
}

export interface ApiWalletTxn {
  id: string;
  type: string;
  source: string;
  amount: number;
  balance: number;
  description: string;
  date: string;
}

export interface ApiLead {
  id: string;
  customerName: string;
  email: string;
  phone: string;
  source: string;
  service: string;
  value: number;
  stage: string;
  assignedTo: string;
  expectedClose: string;
  notes?: string | null;
  createdAt: string;
}

export interface ApiQuotation {
  id: string;
  quoteNo: string;
  customerName: string;
  service: string;
  items: number;
  amount: number;
  gst: number;
  total: number;
  status: string;
  validTill: string;
  createdBy: string;
  createdAt: string;
}

export interface ApiPayment {
  id: string;
  txnId: string;
  customerName: string;
  bookingRef: string;
  amount: number;
  method: string;
  status: string;
  type: string;
  gateway?: string | null;
  date: string;
}

export interface ApiCommissionResponse {
  summary: {
    totalCommission: number;
    paidCommission: number;
    pendingCommission: number;
    totalRevenue: number;
    totalBookings: number;
  };
  byAgency: { agency: string; bookings: number; revenue: number; commission: number }[];
  topAgents: { agent: string; bookings: number; commission: number }[];
  monthly: { month: string; bookings: number; commission: number }[];
}

export interface ApiFinanceInvoice {
  ref: string;
  customer: string;
  agency: string;
  service: string;
  amount: number;
  gst: number;
  total: number;
  date: string;
}

export interface ApiFinanceResponse {
  summary: {
    totalRevenue: number;
    totalGst: number;
    netRevenue: number;
    totalCommission: number;
    totalExpenses: number;
    netProfit: number;
  };
  monthly: { month: string; revenue: number; gst: number; expenses: number; profit: number }[];
  byService: { service: string; revenue: number }[];
  invoices: ApiFinanceInvoice[];
  paymentMethods: Record<string, number>;
}

export interface ApiAnalyticsTrendPoint {
  period: string;
  revenue: number;
  commission: number;
  bookings: number;
}

export interface ApiPlatformAnalytics {
  summary: {
    totalRevenue: number;
    totalCommission: number;
    totalBookings: number;
    activeAgencies: number;
    totalUsers: number;
  };
  trend: ApiAnalyticsTrendPoint[];
  byAgency: { agency: string; bookings: number; revenue: number; commission: number }[];
}

export interface ApiEmployeePerformance {
  id: string;
  name: string;
  designation: string;
  department: string;
  branch: string;
  status: string;
  target: number;
  achieved: number;
  attendance: number;
  bookings: number;
  revenue: number;
  commission: number;
  trend: ApiAnalyticsTrendPoint[];
}

export interface ApiEmployeeAnalytics {
  employees: ApiEmployeePerformance[];
  topPerformers: ApiEmployeePerformance[];
}
