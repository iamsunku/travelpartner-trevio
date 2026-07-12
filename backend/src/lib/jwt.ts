import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET as string;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  agencyId?: string | null;
  branchId?: string | null;
  permissions?: string[] | null;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN as jwt.SignOptions["expiresIn"] });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}
