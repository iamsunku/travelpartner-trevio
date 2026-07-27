export const OPERATIONS_TYPES = [
  { value: "booking", label: "Booking", purpose: "New booking issues", department: "Bookings Team" },
  { value: "cancellation", label: "Cancellation", purpose: "Cancel trips/packages", department: "Bookings Team" },
  { value: "rescheduling", label: "Rescheduling", purpose: "Date modifications", department: "Bookings Team" },
  { value: "hotel_operations", label: "Hotel Operations", purpose: "Hotel confirmation/issues", department: "Hotel Operations" },
  { value: "flight_operations", label: "Flight Operations", purpose: "Flight booking/support", department: "Flight Operations" },
  { value: "bus_operations", label: "Bus Operations", purpose: "Bus ticket support", department: "Ground Transport" },
  { value: "cab_operations", label: "Cab Operations", purpose: "Cab assignment/issues", department: "Ground Transport" },
  { value: "visa_support", label: "Visa Support", purpose: "Visa processing", department: "Documentation" },
  { value: "passport_support", label: "Passport Support", purpose: "Passport assistance", department: "Documentation" },
  { value: "package_operations", label: "Package Operations", purpose: "Tour package changes", department: "Package Operations" },
  { value: "payment_billing", label: "Payment & Billing", purpose: "Payment failures/refunds", department: "Finance" },
  { value: "refund_management", label: "Refund Management", purpose: "Refund tracking", department: "Finance" },
  { value: "vendor_support", label: "Vendor Support", purpose: "Supplier coordination", department: "Vendor Relations" },
  { value: "customer_complaint", label: "Customer Complaint", purpose: "Complaint handling", department: "Customer Experience" },
  { value: "technical_support", label: "Technical Support", purpose: "Dashboard/App bugs", department: "Technical Support" },
  { value: "account_verification", label: "Account Verification", purpose: "Partner KYC/Profile", department: "Partner Operations" },
  { value: "document_verification", label: "Document Verification", purpose: "Travel documents", department: "Documentation" },
  { value: "insurance_support", label: "Insurance Support", purpose: "Travel insurance", department: "Insurance Desk" },
  { value: "emergency_assistance", label: "Emergency Assistance", purpose: "During-trip emergencies", department: "Emergency Desk" },
  { value: "general_inquiry", label: "General Inquiry", purpose: "Miscellaneous", department: "General Support" },
] as const;

export const DELIVERY_TYPES = [
  { value: "instant", label: "Instant", meaning: "Immediate action" },
  { value: "same_day", label: "Same Day", meaning: "Complete within the day" },
  { value: "scheduled", label: "Scheduled", meaning: "Execute on selected date" },
  { value: "manual", label: "Manual", meaning: "Handled manually" },
  { value: "automated", label: "Automated", meaning: "System processes automatically" },
  { value: "online", label: "Online", meaning: "Digital delivery" },
  { value: "offline", label: "Offline", meaning: "Physical coordination required" },
  { value: "onsite", label: "Onsite", meaning: "Requires field executive" },
  { value: "remote", label: "Remote", meaning: "Support over phone/chat/email" },
  { value: "customer_pickup", label: "Customer Pickup", meaning: "Customer collects documents/tickets" },
  { value: "home_delivery", label: "Home Delivery", meaning: "Documents delivered to customer" },
  { value: "partner_delivery", label: "Partner Delivery", meaning: "Sent to travel partner" },
  { value: "third_party", label: "Third Party", meaning: "Vendor handles delivery" },
  { value: "api_delivery", label: "API Delivery", meaning: "Automatically via API integration" },
] as const;

export type OperationsTypeValue = (typeof OPERATIONS_TYPES)[number]["value"];
export type DeliveryTypeValue = (typeof DELIVERY_TYPES)[number]["value"];

export function departmentForOperationsType(value: string): string {
  return OPERATIONS_TYPES.find((o) => o.value === value)?.department ?? "General Support";
}

export function labelForOperationsType(value: string): string {
  return OPERATIONS_TYPES.find((o) => o.value === value)?.label ?? value;
}

export function labelForDeliveryType(value: string): string {
  return DELIVERY_TYPES.find((d) => d.value === value)?.label ?? value;
}

export function purposeForOperationsType(value: string): string {
  return OPERATIONS_TYPES.find((o) => o.value === value)?.purpose ?? "";
}

export function meaningForDeliveryType(value: string): string {
  return DELIVERY_TYPES.find((d) => d.value === value)?.meaning ?? "";
}
