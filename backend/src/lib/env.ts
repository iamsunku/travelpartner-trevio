const INSECURE_DEFAULT_SECRET = "trevio-dev-secret-change-in-production";

export function validateEnv() {
  const isProd = process.env.NODE_ENV === "production";

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Configure it in your environment before starting the server.");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set. Configure it in your environment before starting the server.");
  }

  // Enforce strong JWT_SECRET in production
  if (isProd && process.env.JWT_SECRET === INSECURE_DEFAULT_SECRET) {
    throw new Error("JWT_SECRET is using the known insecure default. Set a long random value (32+ chars) before deploying to production.");
  }

  // Warn about weak JWT_SECRET even in development
  if (process.env.JWT_SECRET.length < 32) {
    if (isProd) {
      throw new Error("JWT_SECRET must be at least 32 characters long for production.");
    }
    console.warn("[env] JWT_SECRET is shorter than recommended (32+ chars). Consider using a stronger secret.");
  }

  // Enforce CORS_ORIGIN in production
  if (isProd && (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === "http://localhost:3000")) {
    throw new Error("CORS_ORIGIN must be set to your production domain in production environment.");
  }

  // Warn about missing email service in production
  if (isProd && !process.env.SENDGRID_API_KEY) {
    console.warn("[env] SENDGRID_API_KEY not set. Email notifications will not be sent in production.");
  }

  // Verify NODE_ENV is set correctly
  if (!process.env.NODE_ENV) {
    console.warn("[env] NODE_ENV not set, defaulting to development");
    process.env.NODE_ENV = "development";
  }

  if (!["development", "production", "test"].includes(process.env.NODE_ENV)) {
    throw new Error("NODE_ENV must be one of: development, production, test");
  }
}
