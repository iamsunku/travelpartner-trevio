export const COUNTRY_CODES = [
  { code: "+91", label: "India (+91)", flag: "🇮🇳" },
  { code: "+65", label: "Singapore (+65)", flag: "🇸🇬" },
  { code: "+971", label: "UAE (+971)", flag: "🇦🇪" },
  { code: "+1", label: "USA (+1)", flag: "🇺🇸" },
  { code: "+44", label: "UK (+44)", flag: "🇬🇧" },
  { code: "+61", label: "Australia (+61)", flag: "🇦🇺" },
  { code: "+60", label: "Malaysia (+60)", flag: "🇲🇾" },
  { code: "+66", label: "Thailand (+66)", flag: "🇹🇭" },
] as const;

export const COUNTRIES = [
  "India",
  "Singapore",
  "United Arab Emirates",
  "United States",
  "United Kingdom",
  "Australia",
  "Malaysia",
  "Thailand",
  "Sri Lanka",
  "Nepal",
  "Bangladesh",
] as const;

export const CITIES_BY_COUNTRY: Record<string, string[]> = {
  India: ["Mumbai", "Delhi", "Bengaluru", "Chennai", "Hyderabad", "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Kochi", "Goa", "Chandigarh"],
  Singapore: ["Singapore"],
  "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah"],
  "United States": ["New York", "Los Angeles", "Chicago", "San Francisco", "Miami"],
  "United Kingdom": ["London", "Manchester", "Birmingham", "Edinburgh"],
  Australia: ["Sydney", "Melbourne", "Brisbane", "Perth"],
  Malaysia: ["Kuala Lumpur", "Penang", "Johor Bahru"],
  Thailand: ["Bangkok", "Phuket", "Chiang Mai"],
  "Sri Lanka": ["Colombo", "Kandy", "Galle"],
  Nepal: ["Kathmandu", "Pokhara"],
  Bangladesh: ["Dhaka", "Chittagong"],
};

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir",
];
