/** Shared geo options for agent registration and related forms. */

export type CountryOption = {
  /** ISO 3166-1 alpha-2 */
  code: string;
  name: string;
  dialCode: string;
  flag: string;
};

export const COUNTRIES_MASTER: CountryOption[] = [
  { code: "IN", name: "India", dialCode: "+91", flag: "🇮🇳" },
  { code: "SG", name: "Singapore", dialCode: "+65", flag: "🇸🇬" },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪" },
  { code: "US", name: "United States", dialCode: "+1", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧" },
  { code: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺" },
  { code: "MY", name: "Malaysia", dialCode: "+60", flag: "🇲🇾" },
  { code: "TH", name: "Thailand", dialCode: "+66", flag: "🇹🇭" },
  { code: "LK", name: "Sri Lanka", dialCode: "+94", flag: "🇱🇰" },
  { code: "NP", name: "Nepal", dialCode: "+977", flag: "🇳🇵" },
  { code: "BD", name: "Bangladesh", dialCode: "+880", flag: "🇧🇩" },
];

/** @deprecated Prefer COUNTRIES_MASTER — kept for existing callers */
export const COUNTRY_CODES = COUNTRIES_MASTER.map((c) => ({
  code: c.dialCode,
  label: `${c.name} (${c.dialCode})`,
  flag: c.flag,
}));

/** @deprecated Prefer COUNTRIES_MASTER */
export const COUNTRIES = COUNTRIES_MASTER.map((c) => c.name);

export const CITIES_BY_COUNTRY: Record<string, string[]> = {
  India: ["Mumbai", "Delhi", "Bengaluru", "Chennai", "Hyderabad", "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Kochi", "Goa", "Chandigarh", "Lucknow", "Indore", "Surat"],
  Singapore: ["Singapore"],
  "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah", "Ajman"],
  "United States": ["New York", "Los Angeles", "Chicago", "San Francisco", "Miami", "Houston", "Seattle"],
  "United Kingdom": ["London", "Manchester", "Birmingham", "Edinburgh", "Glasgow"],
  Australia: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide"],
  Malaysia: ["Kuala Lumpur", "Penang", "Johor Bahru", "Kota Kinabalu"],
  Thailand: ["Bangkok", "Phuket", "Chiang Mai", "Pattaya"],
  "Sri Lanka": ["Colombo", "Kandy", "Galle", "Negombo"],
  Nepal: ["Kathmandu", "Pokhara", "Lalitpur"],
  Bangladesh: ["Dhaka", "Chittagong", "Sylhet"],
};

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry",
];

/** States/provinces keyed by country display name */
export const STATES_BY_COUNTRY: Record<string, string[]> = {
  India: INDIAN_STATES,
  Singapore: ["Singapore"],
  "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"],
  "United States": ["California", "New York", "Texas", "Florida", "Illinois", "Washington", "Massachusetts", "Other"],
  "United Kingdom": ["England", "Scotland", "Wales", "Northern Ireland"],
  Australia: ["New South Wales", "Victoria", "Queensland", "Western Australia", "South Australia", "Tasmania", "ACT", "Northern Territory"],
  Malaysia: ["Kuala Lumpur", "Selangor", "Penang", "Johor", "Sabah", "Sarawak", "Other"],
  Thailand: ["Bangkok", "Phuket", "Chiang Mai", "Chonburi", "Other"],
  "Sri Lanka": ["Western", "Central", "Southern", "Northern", "Eastern", "Other"],
  Nepal: ["Bagmati", "Gandaki", "Koshi", "Lumbini", "Other"],
  Bangladesh: ["Dhaka", "Chittagong", "Khulna", "Rajshahi", "Other"],
};

export function countryByName(name: string): CountryOption | undefined {
  return COUNTRIES_MASTER.find((c) => c.name === name);
}

export function countryByDialCode(dial: string): CountryOption | undefined {
  return COUNTRIES_MASTER.find((c) => c.dialCode === dial);
}

/** Rough national number length ranges by dial code (digits only). */
export const PHONE_DIGIT_RANGE: Record<string, { min: number; max: number }> = {
  "+91": { min: 10, max: 10 },
  "+65": { min: 8, max: 8 },
  "+971": { min: 8, max: 9 },
  "+1": { min: 10, max: 10 },
  "+44": { min: 10, max: 11 },
  "+61": { min: 9, max: 9 },
  "+60": { min: 9, max: 10 },
  "+66": { min: 9, max: 9 },
  "+94": { min: 9, max: 9 },
  "+977": { min: 10, max: 10 },
  "+880": { min: 10, max: 10 },
};

export function validatePhoneDigits(dialCode: string, digits: string): string | null {
  const clean = digits.replace(/\D/g, "");
  if (!clean) return "Mobile number is required";
  const range = PHONE_DIGIT_RANGE[dialCode] ?? { min: 7, max: 15 };
  if (clean.length < range.min || clean.length > range.max) {
    return `Enter a valid ${range.min === range.max ? `${range.min}` : `${range.min}–${range.max}`}-digit mobile number for ${dialCode}`;
  }
  return null;
}

export const AGENT_TERMS_VERSION = "2026-09-1";
