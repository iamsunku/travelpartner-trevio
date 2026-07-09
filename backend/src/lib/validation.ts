import type { Request, Response, NextFunction } from "express";
import { z, type ZodTypeAny } from "zod";

export function validate(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: "Validation failed", details: result.error.flatten().fieldErrors });
      return;
    }
    req.body = result.data;
    next();
  };
}

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const bookingSchema = z.object({
  customerName: z.string().min(1),
  customerId: z.string().optional(),
  service: z.enum(["Flight", "Hotel", "Bus", "Train", "Holiday", "Visa", "Insurance"]),
  route: z.string().min(1),
  travelDate: z.string().min(1),
  amount: z.number().positive(),
  commission: z.number().min(0).optional(),
  paymentMethod: z.string().optional(),
  status: z.enum(["Pending", "Confirmed", "Ticketed", "Completed", "Cancelled", "Refunded", "Failed"]).optional(),
  paymentStatus: z.enum(["Paid", "Pending", "Partial", "Refunded"]).optional(),
  agentName: z.string().min(1),
  agencyName: z.string().min(1),
});

export const customerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  type: z.enum(["Individual", "Corporate"]).optional(),
  tier: z.enum(["Silver", "Gold", "Platinum"]).optional(),
  passportNo: z.string().optional(),
  visaStatus: z.string().optional(),
  city: z.string().optional(),
});

export const leadSchema = z.object({
  customerName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  source: z.string().min(1),
  service: z.string().min(1),
  value: z.number().min(0),
  assignedTo: z.string().min(1),
  expectedClose: z.string().min(1),
  notes: z.string().optional(),
});

export const quotationSchema = z.object({
  customerName: z.string().min(1),
  service: z.string().min(1),
  items: z.number().int().min(1),
  amount: z.number().min(0),
  gst: z.number().min(0),
  total: z.number().min(0),
  validTill: z.string().min(1),
  createdBy: z.string().min(1),
  status: z.string().optional(),
});

export const paymentSchema = z.object({
  customerName: z.string().min(1),
  bookingRef: z.string().min(1),
  amount: z.number().positive(),
  method: z.string().min(1),
  type: z.string().optional(),
  gateway: z.string().optional(),
});

export const employeeSchema = z.object({
  agencyId: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  designation: z.string().min(1),
  department: z.string().optional(),
  branch: z.string().optional(),
  role: z.string().optional(),
  salary: z.number().min(0).optional(),
  target: z.number().min(0).optional(),
  joinDate: z.string().optional(),
});

export const employeeUpdateSchema = employeeSchema.partial().extend({
  status: z.string().optional(),
});

export const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assignedTo: z.string().min(1),
  assignedBy: z.string().optional(),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).optional(),
  dueDate: z.string().min(1),
  relatedTo: z.string().optional(),
});

export const agencySchema = z.object({
  name: z.string().min(1),
  owner: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  plan: z.string().optional(),
  status: z.string().optional(),
  walletBalance: z.number().min(0).optional(),
  apiAllocation: z.record(z.string(), z.number()).optional(),
  gstNumber: z.string().optional(),
  panNumber: z.string().optional(),
  address: z.string().optional(),
});

export const agencyUpdateSchema = agencySchema.partial();

export const branchSchema = z.object({
  agencyId: z.string().optional(),
  name: z.string().min(1),
  manager: z.string().min(1),
  city: z.string().min(1),
  revenue: z.number().min(0).optional(),
});

export const branchUpdateSchema = branchSchema.partial();

export const walletSchema = z.object({
  agencyId: z.string().optional(),
  type: z.enum(["Credit", "Debit"]),
  amount: z.number().positive(),
  source: z.string().optional(),
  description: z.string().optional(),
});
