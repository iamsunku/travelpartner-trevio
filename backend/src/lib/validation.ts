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

const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, "Password must contain at least one special character");

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const bookingSchema = z.object({
  customerName: z.string().min(1),
  customerId: z.string().optional(),
  service: z.enum(["Flight", "Hotel", "Holiday"]),
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
  isInternational: z.boolean().optional(),
  contactPerson: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  destination: z.string().optional(),
  travelDates: z.string().optional(),
  adults: z.number().int().optional(),
  children: z.number().int().optional(),
  infants: z.number().int().optional(),
  hotelStarPreference: z.string().optional(),
  location: z.string().optional(),
  budget: z.number().optional(),
  currency: z.string().optional(),
  packageIncludes: z.array(z.string()).optional(),
  packageExcludes: z.array(z.string()).optional(),
  paymentTerms: z.string().optional(),
  cancellationPolicy: z.string().optional(),
  approvalStatus: z.string().optional(),
  lineItems: z.array(z.object({
    description: z.string(),
    qty: z.number().int().min(1),
    price: z.number().min(0),
  })).optional(),
});

export const internationalQuotationSchema = z.object({
  customerName: z.string().min(1),
  contactPerson: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  destination: z.string().min(1),
  travelDates: z.string().min(1),
  adults: z.number().int().min(1),
  children: z.number().int().min(0).optional(),
  infants: z.number().int().min(0).optional(),
  hotelStarPreference: z.string().optional(),
  location: z.string().optional(),
  budget: z.number().min(0).optional(),
  currency: z.string().optional(),
  packageIncludes: z.array(z.string()).optional(),
  packageExcludes: z.array(z.string()).optional(),
  paymentTerms: z.string().optional(),
  cancellationPolicy: z.string().optional(),
  lineItems: z.array(z.object({
    description: z.string(),
    qty: z.number().int().min(1),
    price: z.number().min(0),
  })).optional(),
  validTill: z.string().min(1),
  createdBy: z.string().min(1),
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
  branchId: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  designation: z.string().min(1),
  department: z.string().optional(),
  branch: z.string().optional(),
  role: z.enum(["employee", "branch_manager", "accountant"]).optional(),
  salary: z.number().min(0).optional(),
  target: z.number().min(0).optional(),
  joinDate: z.string().optional(),
  permissions: z.array(z.string()).optional().nullable(),
});

export const employeeUpdateSchema = employeeSchema.partial().extend({
  status: z.string().optional(),
});

export const employeeCreateWithPasswordSchema = employeeSchema.extend({
  password: passwordSchema,
});

export const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assignedTo: z.string().min(1),
  assignedToId: z.string().optional(),
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

export const attendanceCheckSchema = z.object({});

export const leaveSchema = z.object({
  type: z.enum(["Casual", "Sick", "Earned", "Unpaid"]),
  fromDate: z.string().min(1),
  toDate: z.string().min(1),
  reason: z.string().min(1),
});

export const leaveStatusSchema = z.object({
  status: z.enum(["Approved", "Rejected"]),
});
