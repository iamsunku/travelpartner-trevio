import { PrismaClient } from "@prisma/client";
import {
  AGENCIES, BRANCHES, ROLE_USERS, CUSTOMERS, BOOKINGS, PAYMENTS,
  LEADS, QUOTATIONS, TASKS, NOTIFICATIONS, WALLET_TXNS, EMPLOYEES,
} from "../src/lib/mock-data";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Travel Partner Pro database...");

  // Agencies
  for (const a of AGENCIES) {
    await prisma.agency.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        name: a.name,
        owner: a.owner,
        email: a.email,
        phone: a.phone,
        plan: a.plan,
        status: a.status,
        walletBalance: a.walletBalance,
        commissionEarned: a.commissionEarned,
        totalBookings: a.totalBookings,
        monthlyRevenue: a.monthlyRevenue,
        apiAllocation: JSON.stringify(a.apiAllocation),
        createdAt: new Date(a.createdAt),
      },
    });
  }

  // Branches
  for (const b of BRANCHES) {
    await prisma.branch.upsert({
      where: { id: b.id },
      update: {},
      create: {
        id: b.id,
        agencyId: b.agencyId,
        name: b.name,
        manager: b.manager,
        city: b.city,
        revenue: b.revenue,
      },
    });
  }

  // Users (roles)
  for (const [key, u] of Object.entries(ROLE_USERS)) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        designation: u.designation,
        agencyId: u.agencyId,
        branchId: u.branchId,
        status: "Active",
      },
    });
  }

  // Customers
  for (const c of CUSTOMERS) {
    await prisma.customer.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        type: c.type,
        tier: c.tier,
        totalBookings: c.totalBookings,
        totalSpent: c.totalSpent,
        loyaltyPoints: c.loyaltyPoints,
        passportNo: c.passportNo,
        visaStatus: c.visaStatus,
        city: c.city,
        agencyId: "ag-1",
        createdAt: new Date(c.createdAt),
      },
    });
  }

  // Bookings
  for (const b of BOOKINGS) {
    await prisma.booking.upsert({
      where: { bookingRef: b.bookingRef },
      update: {},
      create: {
        id: b.id,
        bookingRef: b.bookingRef,
        customerName: b.customerName,
        service: b.service,
        route: b.route,
        travelDate: b.travelDate,
        amount: b.amount,
        commission: b.commission,
        status: b.status,
        paymentStatus: b.paymentStatus,
        paymentMethod: b.paymentMethod,
        agentName: b.agent,
        agencyId: "ag-1",
        agencyName: b.agency,
        createdAt: new Date(b.createdAt),
      },
    });
  }

  // Payments
  for (const p of PAYMENTS) {
    await prisma.payment.upsert({
      where: { txnId: p.txnId },
      update: {},
      create: {
        id: p.id,
        txnId: p.txnId,
        customerName: p.customerName,
        bookingRef: p.bookingRef,
        amount: p.amount,
        method: p.method,
        status: p.status,
        type: p.type,
        gateway: p.gateway,
        date: new Date(p.date),
      },
    });
  }

  // Leads
  for (const l of LEADS) {
    await prisma.lead.upsert({
      where: { id: l.id },
      update: {},
      create: {
        id: l.id,
        customerName: l.customerName,
        email: l.email,
        phone: l.phone,
        source: l.source,
        service: l.service,
        value: l.value,
        stage: l.stage,
        assignedTo: l.assignedTo,
        expectedClose: l.expectedClose,
        notes: l.notes,
        createdAt: new Date(l.createdAt),
      },
    });
  }

  // Quotations
  for (const q of QUOTATIONS) {
    await prisma.quotation.upsert({
      where: { quoteNo: q.quoteNo },
      update: {},
      create: {
        id: q.id,
        quoteNo: q.quoteNo,
        customerName: q.customerName,
        service: q.service,
        items: q.items,
        amount: q.amount,
        gst: q.gst,
        total: q.total,
        status: q.status,
        validTill: q.validTill,
        createdBy: q.createdBy,
        createdAt: new Date(q.createdAt),
      },
    });
  }

  // Tasks
  for (const t of TASKS) {
    await prisma.task.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        title: t.title,
        description: t.description,
        assignedTo: t.assignedTo,
        assignedBy: t.assignedBy,
        priority: t.priority,
        status: t.status,
        dueDate: t.dueDate,
        relatedTo: t.relatedTo,
        createdAt: new Date(t.createdAt),
      },
    });
  }

  // Wallet transactions
  for (const w of WALLET_TXNS) {
    await prisma.walletTransaction.upsert({
      where: { id: w.id },
      update: {},
      create: {
        id: w.id,
        agencyId: "ag-1",
        type: w.type,
        source: w.source,
        amount: w.amount,
        balance: w.balance,
        description: w.description,
        date: new Date(w.date),
      },
    });
  }

  // Notifications
  for (const n of NOTIFICATIONS) {
    await prisma.notification.upsert({
      where: { id: n.id },
      update: {},
      create: {
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        priority: n.priority,
        read: n.read,
      },
    });
  }

  // Employees
  for (const e of EMPLOYEES) {
    await prisma.employee.upsert({
      where: { email: e.email },
      update: {},
      create: {
        id: e.id,
        agencyId: "ag-1",
        name: e.name,
        email: e.email,
        phone: e.phone,
        designation: e.designation,
        department: e.department,
        branch: e.branch,
        role: e.role,
        status: e.status,
        salary: e.salary,
        incentives: e.incentives,
        target: e.target,
        achieved: e.achieved,
        attendance: e.attendance,
        joinDate: e.joinDate,
      },
    });
  }

  // Sample audit logs
  const auditSamples = [
    { userName: "Priya Sharma", action: "Logged in", module: "Auth", ip: "103.21.58.14", details: "Successful login" },
    { userName: "Sneha Reddy", action: "Created booking", module: "Bookings", ip: "106.51.74.22", details: "New flight booking" },
    { userName: "Vikram Iyer", action: "Processed refund", module: "Payments", ip: "103.21.58.14", details: "Refund processed" },
    { userName: "System", action: "API call", module: "API", ip: "internal", details: "Flight search completed" },
    { userName: "Arjun Nair", action: "Updated employee", module: "Employees", ip: "49.205.122.88", details: "Role updated" },
  ];
  for (const log of auditSamples) {
    await prisma.auditLog.create({ data: log });
  }

  console.log("Seed complete!");
  const counts = {
    agencies: await prisma.agency.count(),
    branches: await prisma.branch.count(),
    users: await prisma.user.count(),
    customers: await prisma.customer.count(),
    bookings: await prisma.booking.count(),
    payments: await prisma.payment.count(),
    leads: await prisma.lead.count(),
    quotations: await prisma.quotation.count(),
    tasks: await prisma.task.count(),
    employees: await prisma.employee.count(),
    auditLogs: await prisma.auditLog.count(),
    walletTxns: await prisma.walletTransaction.count(),
    notifications: await prisma.notification.count(),
  };
  console.log("Counts:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
