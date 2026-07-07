"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  BOOKINGS,
  CUSTOMERS,
  LEADS,
  QUOTATIONS,
  EMPLOYEES,
  PAYMENTS,
  WALLET_TXNS,
  NOTIFICATIONS,
  TASKS,
} from "@/lib/mock-data";
import type {
  Booking,
  Customer,
  Lead,
  Quotation,
  Employee,
  Payment,
  WalletTransaction,
  Notification,
  Task,
} from "@/types";
import { api } from "@/lib/api";
import {
  mapApiBooking,
  mapApiCustomer,
  mapApiEmployee,
  mapApiLead,
  mapApiNotification,
  mapApiPayment,
  mapApiQuotation,
  mapApiTask,
  mapApiWalletTxn,
} from "@/lib/api-mappers";

export interface VisaApplication {
  id: string;
  country: string;
  type: string;
  applicant: string;
  submittedDate: string;
  appointmentDate: string;
  status: "Submitted" | "Under Review" | "Approved" | "Rejected";
  passport: string;
}

const INITIAL_VISA: VisaApplication[] = [
  { id: "VS-2025-0148", country: "Schengen (Multi)", type: "Tourist", applicant: "Karthik Venkat", submittedDate: "2025-01-08", appointmentDate: "2025-01-25", status: "Approved", passport: "P8394721" },
  { id: "VS-2025-0152", country: "United States", type: "Business", applicant: "Rohit Gupta", submittedDate: "2025-01-12", appointmentDate: "2025-02-04", status: "Under Review", passport: "T5629104" },
  { id: "VS-2025-0161", country: "UAE", type: "Tourist", applicant: "Anjali Desai", submittedDate: "2025-01-15", appointmentDate: "2025-01-22", status: "Submitted", passport: "R2289104" },
  { id: "VS-2025-0144", country: "United Kingdom", type: "Student", applicant: "Imran Khan", submittedDate: "2025-01-03", appointmentDate: "2025-01-12", status: "Rejected", passport: "K9910234" },
  { id: "VS-2025-0158", country: "Singapore", type: "Work", applicant: "Suresh Pillai", submittedDate: "2025-01-14", appointmentDate: "2025-01-30", status: "Approved", passport: "L7720394" },
];

export interface NewBookingInput {
  customerName: string;
  service: Booking["service"];
  route: string;
  travelDate: string;
  amount: number;
  commission?: number;
  paymentMethod?: string;
  agent?: string;
  agency?: string;
}

interface DemoDataState {
  bookings: Booking[];
  customers: Customer[];
  leads: Lead[];
  quotations: Quotation[];
  employees: Employee[];
  tasks: Task[];
  payments: Payment[];
  walletBalance: number;
  walletTxns: WalletTransaction[];
  notifications: Notification[];
  visaApplications: VisaApplication[];
  bookingSeq: number;
  paymentSeq: number;

  addBooking: (input: NewBookingInput) => Booking;
  updateBookingStatus: (id: string, status: Booking["status"]) => void;
  addCustomer: (customer: Omit<Customer, "id" | "totalBookings" | "totalSpent" | "loyaltyPoints" | "createdAt">) => Customer;
  addLead: (lead: Omit<Lead, "id" | "stage" | "createdAt">) => Lead;
  updateLeadStage: (id: string, stage: Lead["stage"]) => void;
  addQuotation: (q: Omit<Quotation, "id" | "quoteNo" | "createdAt" | "status">) => Quotation;
  addEmployee: (e: Omit<Employee, "id" | "joinDate" | "status" | "incentives" | "achieved" | "attendance">) => Employee;
  addTask: (t: Omit<Task, "id" | "createdAt" | "status">) => Task;
  updateTaskStatus: (id: string, status: Task["status"]) => void;
  addPayment: (p: Omit<Payment, "id" | "txnId" | "date" | "status">) => Payment;
  walletTopUp: (amount: number, method: string) => void;
  walletTransfer: (amount: number, description: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addVisaApplication: (app: Omit<VisaApplication, "id" | "submittedDate" | "status" | "appointmentDate">) => VisaApplication;
  hydrateFromApi: (agencyId?: string) => Promise<void>;
  resetDemoData: () => void;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nextBookingRef(seq: number) {
  return `BK-${seq}`;
}

function nextTxnId(seq: number) {
  return `pay_${seq.toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

const initialState = {
  bookings: BOOKINGS,
  customers: CUSTOMERS,
  leads: LEADS,
  quotations: QUOTATIONS,
  employees: EMPLOYEES,
  tasks: TASKS,
  payments: PAYMENTS,
  walletBalance: 845000,
  walletTxns: WALLET_TXNS,
  notifications: NOTIFICATIONS,
  visaApplications: INITIAL_VISA,
  bookingSeq: 8853,
  paymentSeq: 100,
};

export const useDemoDataStore = create<DemoDataState>()(
  persist(
    (set, get) => ({
      ...initialState,

      addBooking: (input) => {
        const seq = get().bookingSeq;
        const bookingRef = nextBookingRef(seq);
        const commission = input.commission ?? Math.round(input.amount * 0.05);
        const booking: Booking = {
          id: `bk-${Date.now()}`,
          bookingRef,
          customerName: input.customerName,
          service: input.service,
          route: input.route,
          travelDate: input.travelDate,
          amount: input.amount,
          commission,
          status: "Confirmed",
          paymentStatus: "Paid",
          paymentMethod: input.paymentMethod ?? "Razorpay",
          agent: input.agent ?? "Sneha Reddy",
          agency: input.agency ?? "Wanderlust Travels",
          createdAt: todayISO(),
        };
        const payment: Payment = {
          id: `py-${Date.now()}`,
          txnId: nextTxnId(get().paymentSeq),
          customerName: input.customerName,
          bookingRef,
          amount: input.amount,
          method: (input.paymentMethod as Payment["method"]) ?? "Razorpay",
          status: "Success",
          type: "Payment",
          date: todayISO(),
          gateway: "Razorpay",
        };
        const notification: Notification = {
          id: `nt-${Date.now()}`,
          type: "booking",
          title: "New Booking Confirmed",
          message: `${bookingRef} - ${input.customerName} booked ${input.service} for ₹${input.amount.toLocaleString("en-IN")}`,
          time: "Just now",
          read: false,
          priority: "high",
        };
        set((s) => ({
          bookings: [booking, ...s.bookings],
          payments: [payment, ...s.payments],
          notifications: [notification, ...s.notifications],
          bookingSeq: seq + 1,
          paymentSeq: s.paymentSeq + 1,
        }));

        api
          .createBooking({
            customerName: input.customerName,
            service: input.service,
            route: input.route,
            travelDate: input.travelDate,
            amount: input.amount,
            commission,
            agentName: input.agent ?? "Sneha Reddy",
            agencyName: input.agency ?? "Wanderlust Travels",
          })
          .catch(() => undefined);

        return booking;
      },

      updateBookingStatus: (id, status) => {
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === id
              ? {
                  ...b,
                  status,
                  paymentStatus: status === "Cancelled" ? "Refunded" : status === "Refunded" ? "Refunded" : b.paymentStatus,
                }
              : b
          ),
        }));
        const paymentStatus =
          status === "Cancelled" || status === "Refunded" ? "Refunded" : undefined;
        api
          .updateBooking(id, { status, ...(paymentStatus ? { paymentStatus } : {}) })
          .catch(() => undefined);
      },

      addCustomer: (input) => {
        const customer: Customer = {
          ...input,
          id: `cu-${Date.now()}`,
          totalBookings: 0,
          totalSpent: 0,
          loyaltyPoints: 0,
          createdAt: todayISO(),
        };
        set((s) => ({ customers: [customer, ...s.customers] }));
        api
          .createCustomer({
            name: input.name,
            email: input.email,
            phone: input.phone,
            type: input.type,
            tier: input.tier,
            passportNo: input.passportNo,
            visaStatus: input.visaStatus,
            city: input.city,
          })
          .catch(() => undefined);
        return customer;
      },

      addLead: (input) => {
        const lead: Lead = {
          ...input,
          id: `ld-${Date.now()}`,
          stage: "New",
          createdAt: todayISO(),
        };
        set((s) => ({ leads: [lead, ...s.leads] }));
        api
          .createLead({
            customerName: input.customerName,
            email: input.email,
            phone: input.phone,
            source: input.source,
            service: input.service,
            value: input.value,
            assignedTo: input.assignedTo,
            expectedClose: input.expectedClose,
            notes: input.notes,
          })
          .catch(() => undefined);
        return lead;
      },

      updateLeadStage: (id, stage) => {
        set((s) => ({
          leads: s.leads.map((l) => (l.id === id ? { ...l, stage } : l)),
        }));
        api.updateLeadStage(id, stage).catch(() => undefined);
      },

      addQuotation: (input) => {
        const quoteNo = `QT-2025-${String(get().quotations.length + 19).padStart(3, "0")}`;
        const quotation: Quotation = {
          ...input,
          id: `qt-${Date.now()}`,
          quoteNo,
          status: "Draft",
          createdAt: todayISO(),
        };
        set((s) => ({ quotations: [quotation, ...s.quotations] }));
        api
          .createQuotation({
            customerName: input.customerName,
            service: input.service,
            items: input.items,
            amount: input.amount,
            gst: input.gst,
            total: input.total,
            validTill: input.validTill,
            createdBy: input.createdBy,
            status: "Draft",
          })
          .catch(() => undefined);
        return quotation;
      },

      addEmployee: (input) => {
        const employee: Employee = {
          ...input,
          id: `em-${Date.now()}`,
          status: "Active",
          incentives: 0,
          achieved: 0,
          attendance: 95,
          joinDate: todayISO(),
        };
        set((s) => ({ employees: [employee, ...s.employees] }));
        api
          .createEmployee({
            name: input.name,
            email: input.email,
            phone: input.phone,
            designation: input.designation,
            department: input.department,
            branch: input.branch,
            role: input.role,
            salary: input.salary,
            target: input.target,
          })
          .catch(() => undefined);
        return employee;
      },

      addTask: (input) => {
        const task: Task = {
          ...input,
          id: `tk-${Date.now()}`,
          status: "To Do",
          createdAt: todayISO(),
        };
        set((s) => ({ tasks: [task, ...s.tasks] }));
        api
          .createTask({
            title: input.title,
            description: input.description,
            assignedTo: input.assignedTo,
            assignedBy: input.assignedBy,
            priority: input.priority,
            dueDate: input.dueDate,
            relatedTo: input.relatedTo,
            status: "To Do",
          })
          .catch(() => undefined);
        return task;
      },

      updateTaskStatus: (id, status) => {
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
        }));
        api.updateTask(id, { status }).catch(() => undefined);
      },

      addPayment: (input) => {
        const payment: Payment = {
          ...input,
          id: `py-${Date.now()}`,
          txnId: nextTxnId(get().paymentSeq),
          status: "Success",
          date: todayISO(),
        };
        set((s) => ({
          payments: [payment, ...s.payments],
          paymentSeq: s.paymentSeq + 1,
        }));
        api
          .createPayment({
            customerName: input.customerName,
            bookingRef: input.bookingRef,
            amount: input.amount,
            method: input.method,
            type: input.type,
            gateway: input.gateway,
          })
          .catch(() => undefined);
        return payment;
      },

      walletTopUp: (amount, method) => {
        set((s) => {
          const balance = s.walletBalance + amount;
          const txn: WalletTransaction = {
            id: `wt-${Date.now()}`,
            type: "Credit",
            source: "Top-up",
            amount,
            balance,
            description: `Wallet top-up via ${method}`,
            date: todayISO(),
          };
          return { walletBalance: balance, walletTxns: [txn, ...s.walletTxns] };
        });
        api
          .walletTransaction({
            type: "Credit",
            amount,
            source: "Top-up",
            description: `Wallet top-up via ${method}`,
            agencyId: "ag-1",
          })
          .catch(() => undefined);
      },

      walletTransfer: (amount, description) => {
        set((s) => {
          const balance = s.walletBalance - amount;
          const txn: WalletTransaction = {
            id: `wt-${Date.now()}`,
            type: "Debit",
            source: "Transfer",
            amount,
            balance,
            description,
            date: todayISO(),
          };
          return { walletBalance: balance, walletTxns: [txn, ...s.walletTxns] };
        });
        api
          .walletTransaction({
            type: "Debit",
            amount,
            source: "Transfer",
            description,
            agencyId: "ag-1",
          })
          .catch(() => undefined);
      },

      markNotificationRead: (id) => {
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        }));
        api.markNotificationRead(id).catch(() => undefined);
      },

      markAllNotificationsRead: () => {
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
        }));
      },

      addVisaApplication: (input) => {
        const id = `VS-2025-${Math.floor(1000 + Math.random() * 9000)}`;
        const submitted = todayISO();
        const appointment = new Date();
        appointment.setDate(appointment.getDate() + 14);
        const app: VisaApplication = {
          ...input,
          id,
          submittedDate: submitted,
          appointmentDate: appointment.toISOString().slice(0, 10),
          status: "Submitted",
        };
        set((s) => ({ visaApplications: [app, ...s.visaApplications] }));
        return app;
      },

      resetDemoData: () => set({ ...initialState }),

      hydrateFromApi: async (agencyId) => {
        try {
          const [bookingsRes, customersRes, notificationsRes, leadsRes, quotationsRes, paymentsRes, employeesRes, tasksRes] =
            await Promise.all([
              api.getBookings(),
              api.getCustomers(),
              api.getNotifications(),
              api.getLeads(),
              api.getQuotations(),
              api.getPayments(),
              api.getEmployees(agencyId),
              api.getTasks(),
            ]);

          const patch: Partial<DemoDataState> = {};

          if (bookingsRes.bookings?.length) {
            patch.bookings = bookingsRes.bookings.map(mapApiBooking);
          }
          if (customersRes.customers?.length) {
            patch.customers = customersRes.customers.map(mapApiCustomer);
          }
          if (notificationsRes.notifications?.length) {
            patch.notifications = notificationsRes.notifications.map(mapApiNotification);
          }
          if (leadsRes.leads?.length) {
            patch.leads = leadsRes.leads.map(mapApiLead);
          }
          if (quotationsRes.quotations?.length) {
            patch.quotations = quotationsRes.quotations.map(mapApiQuotation);
          }
          if (paymentsRes.payments?.length) {
            patch.payments = paymentsRes.payments.map(mapApiPayment);
          }
          if (employeesRes.employees?.length) {
            patch.employees = employeesRes.employees.map(mapApiEmployee);
          }
          if (tasksRes.tasks?.length) {
            patch.tasks = tasksRes.tasks.map(mapApiTask);
          }

          if (agencyId) {
            try {
              const walletRes = await api.getWallet(agencyId);
              patch.walletBalance = walletRes.balance;
              if (walletRes.transactions?.length) {
                patch.walletTxns = walletRes.transactions.map(mapApiWalletTxn);
              }
            } catch {
              /* wallet optional */
            }
          }

          if (Object.keys(patch).length) set(patch);
        } catch {
          /* offline — keep local demo data */
        }
      },
    }),
    { name: "tpp-demo-data" }
  )
);
