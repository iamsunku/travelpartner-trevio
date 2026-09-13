/** Safe client-facing message for unexpected Prisma / runtime errors. */
export function publicErrorMessage(e: unknown, fallback = "Server error"): string {
  if (e && typeof e === "object" && "code" in e) {
    const code = String((e as { code?: string }).code);
    if (code === "P2002") return "A record with that number already exists. Please retry.";
    if (code === "P2003") return "A related record is missing or invalid.";
    if (code === "P2025") return "Record not found.";
  }
  if (e instanceof Error && process.env.NODE_ENV !== "production") return e.message;
  return fallback;
}
