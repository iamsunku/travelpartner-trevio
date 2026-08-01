import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "../lib/jwt.js";
import { hasPermission, hasCrudPermission, type Module, type CrudAction } from "../lib/permissions.js";
import { db } from "../lib/db.js";

export interface AuthRequest extends Request {
  auth?: JwtPayload;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    req.auth = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      req.auth = verifyToken(header.slice(7));
    } catch {
      /* ignore invalid token for optional routes */
    }
  }
  next();
}

// Fresh DB lookup so a role change or deactivation takes effect immediately
// instead of only after the user's token expires and they log in again.
export function requireRole(...roles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    try {
      const user = await db.user.findUnique({ where: { id: req.auth.userId }, select: { role: true, status: true } });
      if (!user || user.status !== "Active" || !roles.includes(user.role)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      next();
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  };
}

// Looks up the caller's *current* role/permissions/status from the DB on every
// call, rather than trusting the JWT payload — so an admin narrowing someone's
// access (or deactivating them) takes effect immediately, not after their next
// login. Slightly more expensive than a JWT-only check, but these are the
// write/list endpoints that actually gate access to a module, so correctness
// here matters more than shaving one query.
async function currentPermissionSubject(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: { role: true, permissions: true, status: true },
  });
}

export function requirePermission(module: Module) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    try {
      const user = await currentPermissionSubject(req.auth.userId);
      if (!user || user.status !== "Active") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      // Honor Settings → rolePermissions overrides (view gate for module access)
      if (req.auth.agencyId) {
        const settings = await db.settings.findUnique({
          where: { agencyId: req.auth.agencyId },
          select: { rolePermissions: true },
        });
        const overrides = settings?.rolePermissions as Record<string, Record<string, CrudAction[]>> | null;
        if (overrides?.[user.role]?.[module]) {
          const allowed = overrides[user.role][module];
          if (!hasPermission(user, module) || !allowed.includes("view")) {
            res.status(403).json({ error: "Forbidden" });
            return;
          }
          next();
          return;
        }
      }

      if (!hasPermission(user, module)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      next();
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  };
}

export function requireCrudPermission(module: Module, action: CrudAction) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    try {
      const user = await currentPermissionSubject(req.auth.userId);
      if (!user || user.status !== "Active") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      // Agency-level role CRUD overrides from Settings (if configured)
      let subject = user;
      if (req.auth.agencyId) {
        const settings = await db.settings.findUnique({
          where: { agencyId: req.auth.agencyId },
          select: { rolePermissions: true },
        });
        const overrides = settings?.rolePermissions as Record<string, Record<string, CrudAction[]>> | null;
        if (overrides?.[user.role]?.[module]) {
          const allowed = overrides[user.role][module];
          if (!hasPermission(user, module) || !allowed.includes(action)) {
            res.status(403).json({ error: "Forbidden" });
            return;
          }
          next();
          return;
        }
      }

      if (!hasCrudPermission(subject, module, action)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      next();
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  };
}

export function requireAnyPermission(...modules: Module[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    try {
      const user = await currentPermissionSubject(req.auth.userId);
      if (!user || user.status !== "Active" || !modules.some((m) => hasPermission(user, m))) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      next();
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  };
}
