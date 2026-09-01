import { db } from "./db.js";
import { notify } from "./bms.js";

export function derivePayoutStatus(
  amount: number,
  amountPaid: number,
  dueDate?: string | null,
  scheduledPayDate?: string | null,
): string {
  if (amount > 0 && amountPaid >= amount) return "Paid";
  if (amountPaid > 0) return "Partial";
  const today = new Date().toISOString().slice(0, 10);
  if (dueDate && dueDate < today) return "Overdue";
  if (scheduledPayDate && scheduledPayDate > today) return "Scheduled";
  return "Pending";
}

export async function processPayoutReminders(scope: Record<string, unknown> = {}) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const payouts = await db.supplierPayout.findMany({
    where: {
      status: { in: ["Pending", "Partial", "Overdue", "Scheduled"] },
      ...scope,
    },
    include: { booking: { select: { bookingRef: true } } },
  });

  let reminded = 0;
  for (const p of payouts) {
    const status = derivePayoutStatus(p.amount, p.amountPaid, p.dueDate, p.scheduledPayDate);
    if (status !== p.status) {
      await db.supplierPayout.update({ where: { id: p.id }, data: { status } });
    }

    if (!p.dueDate || p.status === "Paid") continue;
    const remindAt = new Date(p.dueDate);
    remindAt.setDate(remindAt.getDate() - (p.reminderDaysBefore || 2));
    const remindStr = remindAt.toISOString().slice(0, 10);
    const inWindow = todayStr >= remindStr && todayStr <= p.dueDate;
    const alreadySentToday =
      p.reminderSentAt && p.reminderSentAt.toISOString().slice(0, 10) === todayStr;

    if (inWindow && !alreadySentToday) {
      const ref = p.booking?.bookingRef || "booking";
      await notify({
        agencyId: p.agencyId,
        type: "reminder",
        title: "Supplier payout due soon",
        message: `₹${p.amount - p.amountPaid} to ${p.supplierName} for ${ref} — due ${p.dueDate}`,
        priority: status === "Overdue" ? "high" : "medium",
      });
      await db.supplierPayout.update({
        where: { id: p.id },
        data: { reminderSentAt: today },
      });
      reminded += 1;
    }
  }
  return reminded;
}
