export const CURRENCY_OPTIONS = [
  { code: "INR", label: "INR — Indian Rupee (₹)" },
  { code: "USD", label: "USD — US Dollar ($)" },
  { code: "SGD", label: "SGD — Singapore Dollar (S$)" },
  { code: "AED", label: "AED — UAE Dirham" },
  { code: "EUR", label: "EUR — Euro (€)" },
  { code: "GBP", label: "GBP — British Pound (£)" },
  { code: "AUD", label: "AUD — Australian Dollar (A$)" },
  { code: "CAD", label: "CAD — Canadian Dollar (C$)" },
  { code: "THB", label: "THB — Thai Baht (฿)" },
  { code: "MYR", label: "MYR — Malaysian Ringgit (RM)" },
] as const;

export const ROOM_CATEGORY_PRESETS = [
  "Standard Room",
  "Deluxe Room",
  "Suite Room",
  "Superior Room",
  "Executive Room",
] as const;
