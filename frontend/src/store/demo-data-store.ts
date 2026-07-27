"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Booking,
  Customer,
  Lead,
  Quotation,
  NewQuotationInput,
  Employee,
  Payment,
  WalletTransaction,
  Notification,
  Task,
  Module,
} from "@/types";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
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
  mapApiFinance,
  mapApiCommission,
} from "@/lib/api-mappers";

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
  status?: Booking["status"];
  paymentStatus?: Booking["paymentStatus"];
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
  bookingSeq: number;
  paymentSeq: number;

  dashboardStats: any;
  financeStats: any;
  commissionStats: any;

  addBooking: (input: NewBookingInput) => Booking;
  updateBookingStatus: (id: string, status: Booking["status"]) => void;
  addCustomer: (customer: Omit<Customer, "id" | "totalBookings" | "totalSpent" | "loyaltyPoints" | "createdAt">) => Customer;
  addLead: (lead: Omit<Lead, "id" | "stage" | "createdAt">) => Lead;
  updateLeadStage: (id: string, stage: Lead["stage"]) => void;
  addQuotation: (q: NewQuotationInput) => Quotation;
  addEmployee: (e: Omit<Employee, "id" | "joinDate" | "status" | "incentives" | "achieved" | "attendance"> & { branchId?: string; permissions?: Module[] | null }) => Promise<Employee & { tempPassword?: string }>;
  updateEmployee: (id: string, patch: Partial<Employee> & { branchId?: string | null; permissions?: Module[] | null }) => Promise<void>;
  addTask: (t: Omit<Task, "id" | "createdAt" | "status">) => Task;
  updateTaskStatus: (id: string, status: Task["status"]) => void;
  addPayment: (p: Omit<Payment, "id" | "txnId" | "date" | "status">) => Payment;
  walletTopUp: (amount: number, method: string) => void;
  walletTransfer: (amount: number, description: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
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

function reportSyncFailure(entityLabel: string) {
  toast({
    title: "Sync issue",
    description: `${entityLabel} saved locally but couldn't reach the server. It may not appear in reports until you're back online.`,
    variant: "destructive",
  });
}

const initialState = {
  bookings: [] as Booking[],
  customers: [] as Customer[],
  leads: [] as Lead[],
  quotations: [] as Quotation[],
  employees: [] as Employee[],
  tasks: [] as Task[],
  payments: [] as Payment[],
  walletBalance: 0,
  walletTxns: [] as WalletTransaction[],
  notifications: [] as Notification[],
  bookingSeq: 1,
  paymentSeq: 1,
  dashboardStats: null,
  financeStats: null,
  commissionStats: null,
};

export const useDemoDataStore = create<DemoDataState>()(
  persist(
    (set, get) => ({
      ...initialState,

      addBooking: (input) => {
        const seq = get().bookingSeq;
        const bookingRef = nextBookingRef(seq);
        const commission = input.commission ?? Math.round(input.amount * 0.05);
        const resolvedStatus = input.status ?? "Confirmed";
        const resolvedPaymentStatus = input.paymentStatus ?? "Paid";
        const isPaid = resolvedPaymentStatus === "Paid";
        const booking: Booking = {
          id: `bk-${Date.now()}`,
          bookingRef,
          customerName: input.customerName,
          service: input.service,
          route: input.route,
          travelDate: input.travelDate,
          amount: input.amount,
          commission,
          status: resolvedStatus,
          paymentStatus: resolvedPaymentStatus,
          paymentMethod: input.paymentMethod ?? "Razorpay",
          agent: input.agent ?? "Sneha Reddy",
          agency: input.agency ?? "Wanderlust Travels",
          createdAt: todayISO(),
        };
        const payment: Payment | null = isPaid ? {
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
        } : null;
        const notification: Notification = {
          id: `nt-${Date.now()}`,
          type: "booking",
          title: isPaid ? "New Booking Confirmed" : "New Booking Submitted",
          message: `${bookingRef} - ${input.customerName} booked ${input.service} for ₹${input.amount.toLocaleString("en-IN")}`,
          time: "Just now",
          read: false,
          priority: "high",
        };
        set((s) => ({
          bookings: [booking, ...s.bookings],
          payments: payment ? [payment, ...s.payments] : s.payments,
          notifications: [notification, ...s.notifications],
          bookingSeq: seq + 1,
          paymentSeq: payment ? s.paymentSeq + 1 : s.paymentSeq,
        }));

        api
          .createBooking({
            customerName: input.customerName,
            service: input.service,
            route: input.route,
            travelDate: input.travelDate,
            amount: input.amount,
            commission,
            status: resolvedStatus,
            paymentStatus: resolvedPaymentStatus,
            paymentMethod: input.paymentMethod,
            agentName: input.agent ?? "Sneha Reddy",
            agencyName: input.agency ?? "Wanderlust Travels",
          })
          .catch(() => reportSyncFailure("Booking"));

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
          .catch(() => reportSyncFailure("Booking update"));
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
          .catch(() => reportSyncFailure("Customer"));
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
          .catch(() => reportSyncFailure("Lead"));
        return lead;
      },

      updateLeadStage: (id, stage) => {
        set((s) => ({
          leads: s.leads.map((l) => (l.id === id ? { ...l, stage } : l)),
        }));
        api.updateLeadStage(id, stage).catch(() => reportSyncFailure("Lead update"));
      },

      addQuotation: (input: NewQuotationInput) => {
        const quoteNo = `QT-2025-${String(get().quotations.length + 19).padStart(3, "0")}`;
        const quotation: Quotation = {
          ...input,
          id: `qt-${Date.now()}`,
          quoteNo,
          status: input.status ?? "Draft",
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
            status: quotation.status,
            isInternational: input.isInternational,
            contactPerson: input.contactPerson,
            contactEmail: input.contactEmail,
            contactPhone: input.contactPhone,
            destination: input.destination,
            travelDates: input.travelDates,
            adults: input.adults,
            children: input.children,
            infants: input.infants,
            hotelStarPreference: input.hotelStarPreference,
            location: input.location,
            budget: input.budget,
            currency: input.currency,
            packageIncludes: input.packageIncludes,
            packageExcludes: input.packageExcludes,
            paymentTerms: input.paymentTerms,
            cancellationPolicy: input.cancellationPolicy,
            approvalStatus: input.approvalStatus,
            lineItems: input.lineItems,
          })
          .catch(() => reportSyncFailure("Quotation"));
        return quotation;
      },

      addEmployee: async (input) => {
        const { branchId, permissions, ...employeeFields } = input;
        const employee: Employee = {
          ...employeeFields,
          id: `em-${Date.now()}`,
          status: "Active",
          incentives: 0,
          achieved: 0,
          attendance: 95,
          joinDate: todayISO(),
        };
        set((s) => ({ employees: [employee, ...s.employees] }));
        try {
          const res = await api.createEmployee({
            name: input.name,
            email: input.email,
            phone: input.phone,
            designation: input.designation,
            department: input.department,
            branch: input.branch,
            branchId,
            role: input.role,
            salary: input.salary,
            target: input.target,
            permissions,
          });
          return { ...employee, tempPassword: res.tempPassword };
        } catch {
          reportSyncFailure("Employee");
          return employee;
        }
      },

      updateEmployee: async (id, patch) => {
        set((s) => ({ employees: s.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
        try {
          await api.updateEmployee(id, patch);
        } catch {
          reportSyncFailure("Employee update");
        }
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
          .catch(() => reportSyncFailure("Task"));
        return task;
      },

      updateTaskStatus: (id, status) => {
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
        }));
        api.updateTask(id, { status }).catch(() => reportSyncFailure("Task update"));
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
          .catch(() => reportSyncFailure("Payment"));
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
          })
          .catch(() => reportSyncFailure("Wallet top-up"));
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
          })
          .catch(() => reportSyncFailure("Wallet transfer"));
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
        api.markAllNotificationsRead().catch(() => undefined);
      },

      resetDemoData: () => set({ ...initialState }),

      hydrateFromApi: async (agencyId) => {
        try {
    const [bookingsRes, customersRes, notificationsRes, leadsRes, quotationsRes, paymentsRes, employeesRes, tasksRes, dashboardRes, financeRes, commissionRes] =
      await Promise.all([
        api.getBookings(),
        api.getCustomers(),
        api.getNotifications(),
        api.getLeads(),
        api.getQuotations(),
        api.getPayments(),
        api.getEmployees(agencyId),
        api.getTasks(),
        api.getDashboard(),
        api.getFinance(),
        api.getCommission(),
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
          
          if (dashboardRes?.stats) patch.dashboardStats = dashboardRes.stats;
          if (financeRes?.summary) patch.financeStats = mapApiFinance(financeRes);
          if (commissionRes?.summary) patch.commissionStats = mapApiCommission(commissionRes);

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
