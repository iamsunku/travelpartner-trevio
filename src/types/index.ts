// Travel Partner Pro — Core Types

export type Role =
  | "super_admin"
  | "agency_admin"
  | "branch_manager"
  | "employee"
  | "accountant"
  | "customer";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  avatar?: string;
  agencyId?: string;
  branchId?: string;
  designation?: string;
}

export interface Agency {
  id: string;
  name: string;
  owner: string;
  email: string;
  phone: string;
  plan: "Starter" | "Growth" | "Enterprise";
  status: "Active" | "Suspended" | "Trial";
  walletBalance: number;
  commissionEarned: number;
  totalBookings: number;
  monthlyRevenue: number;
  apiAllocation: { flights: number; hotels: number; bus: number; train: number };
  createdAt: string;
  branches: number;
  employees: number;
}

export interface Branch {
  id: string;
  agencyId: string;
  name: string;
  manager: string;
  city: string;
  employees: number;
  revenue: number;
}

export interface Flight {
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
  cabin: "Economy" | "Premium Economy" | "Business" | "First";
  seatsLeft: number;
  refundable: boolean;
  aircraft: string;
  rating: number;
}

export interface Hotel {
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
  rooms: RoomType[];
}

export interface RoomType {
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

export interface Bus {
  id: string;
  operator: string;
  busType: "AC Sleeper" | "AC Seater" | "Non-AC Sleeper" | "Volvo Multi-Axle" | "Mercedes";
  origin: string;
  destination: string;
  departTime: string;
  arriveTime: string;
  duration: string;
  price: number;
  seatsLeft: number;
  rating: number;
  amenities: string[];
  boardingPoints: string[];
  droppingPoints: string[];
}

export interface HolidayPackage {
  id: string;
  title: string;
  destination: string;
  country: string;
  type: "Honeymoon" | "Family" | "Group" | "Corporate" | "Educational" | "Religious" | "Adventure";
  duration: string;
  nights: number;
  days: number;
  price: number;
  originalPrice: number;
  rating: number;
  reviews: number;
  image: string;
  highlights: string[];
  inclusions: string[];
  isInternational: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: "Individual" | "Corporate";
  totalBookings: number;
  totalSpent: number;
  loyaltyPoints: number;
  tier: "Silver" | "Gold" | "Platinum";
  passportNo?: string;
  visaStatus?: "Valid" | "Expired" | "None";
  lastBooking?: string;
  city: string;
  createdAt: string;
  avatar?: string;
}

export interface Lead {
  id: string;
  customerName: string;
  email: string;
  phone: string;
  source: "Website" | "WhatsApp" | "Phone" | "Walk-in" | "Facebook" | "Instagram" | "Google Ads" | "Referral";
  service: "Flight" | "Hotel" | "Holiday" | "Visa" | "Insurance" | "Bus" | "Train";
  value: number;
  stage: "New" | "Qualified" | "Follow-up" | "Quotation Sent" | "Negotiation" | "Won" | "Lost";
  assignedTo: string;
  expectedClose: string;
  createdAt: string;
  notes: string;
}

export interface Booking {
  id: string;
  bookingRef: string;
  customerName: string;
  service: "Flight" | "Hotel" | "Bus" | "Train" | "Holiday" | "Visa" | "Insurance";
  route: string;
  travelDate: string;
  amount: number;
  commission: number;
  status: "Pending" | "Confirmed" | "Ticketed" | "Completed" | "Cancelled" | "Refunded" | "Failed";
  paymentStatus: "Paid" | "Pending" | "Partial" | "Refunded";
  paymentMethod?: string;
  agent: string;
  agency: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  txnId: string;
  customerName: string;
  bookingRef: string;
  amount: number;
  method: "Razorpay" | "UPI" | "Card" | "Net Banking" | "Cash" | "Bank Transfer" | "Wallet";
  status: "Success" | "Pending" | "Failed" | "Refunded";
  type: "Payment" | "Refund" | "Wallet Credit" | "Commission";
  date: string;
  gateway?: string;
}

export interface WalletTransaction {
  id: string;
  type: "Credit" | "Debit";
  source: "Commission" | "Payment" | "Refund" | "Top-up" | "Transfer" | "Booking";
  amount: number;
  balance: number;
  description: string;
  date: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  department: "Sales" | "Operations" | "Accounts" | "Support" | "Management";
  branch: string;
  role: Role;
  status: "Active" | "On Leave" | "Inactive";
  salary: number;
  incentives: number;
  target: number;
  achieved: number;
  attendance: number;
  joinDate: string;
  avatar?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  assignedBy: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  status: "To Do" | "In Progress" | "Review" | "Completed";
  dueDate: string;
  relatedTo?: string;
  createdAt: string;
}

export interface Quotation {
  id: string;
  quoteNo: string;
  customerName: string;
  service: "Flight" | "Hotel" | "Holiday" | "Visa" | "Insurance";
  items: number;
  amount: number;
  gst: number;
  total: number;
  status: "Draft" | "Sent" | "Accepted" | "Rejected" | "Expired";
  validTill: string;
  createdBy: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: "booking" | "payment" | "api" | "customer" | "internal" | "task";
  title: string;
  message: string;
  time: string;
  read: boolean;
  priority: "low" | "medium" | "high";
}

export type ViewKey =
  | "dashboard"
  | "flights"
  | "hotels"
  | "bus"
  | "train"
  | "holiday"
  | "visa"
  | "insurance"
  | "customers"
  | "crm"
  | "quotations"
  | "bookings"
  | "payments"
  | "wallet"
  | "commission"
  | "reports"
  | "employees"
  | "tasks"
  | "support"
  | "notifications"
  | "marketing"
  | "cms"
  | "finance"
  | "api-management"
  | "settings"
  | "audit-logs"
  | "agencies"
  | "branches"
  | "api-marketplace"
  | "monitoring";
