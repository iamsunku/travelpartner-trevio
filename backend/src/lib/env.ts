const INSECURE_DEFAULT_SECRET = "trevio-dev-secret-change-in-production";

export function validateEnv() {
  const isProd = process.env.NODE_ENV === "production";

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Configure it in your environment before starting the server.");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set. Configure it in your environment before starting the server.");
  }

  if (process.env.JWT_SECRET === INSECURE_DEFAULT_SECRET) {
    if (isProd) {
      throw new Error("JWT_SECRET is using the known insecure default. Set a long random value before deploying.");
    }
    console.warn("[env] JWT_SECRET is using the known insecure default — fine for local dev, but must be changed before deploying.");
  }
}
