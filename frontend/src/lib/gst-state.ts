/** Indian GST state codes — first two digits of GSTIN */
export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
};

export function stateFromGstin(gstin: string | null | undefined): string | null {
  const normalized = String(gstin || "").trim().toUpperCase();
  if (normalized.length < 2 || !/^\d{2}/.test(normalized)) return null;
  return GST_STATE_CODES[normalized.slice(0, 2)] || null;
}

export function resolveGstState(
  explicitState: string | null | undefined,
  gstin: string | null | undefined,
): string | null {
  const explicit = String(explicitState || "").trim();
  if (explicit) return explicit;
  return stateFromGstin(gstin);
}
