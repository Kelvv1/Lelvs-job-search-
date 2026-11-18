import { NextFunction, Request, Response } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { getOrCreateUser } from '../db/users.ts';
import { adminAuth } from '../lib/firebase-admin.ts';

export interface DbUserRecord {
  id: number;
  uid: string;
  email: string;
  displayName: string | null;
  role: string;
  preferredCategories: string[];
  preferredLocations: string[];
  preferredWorkMode: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: DbUserRecord;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    const email = decodedToken.email || `${decodedToken.uid}@user.local`;
    req.dbUser = await getOrCreateUser(decodedToken.uid, email, decodedToken.name ?? null);
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }
};

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    const email = decodedToken.email || `${decodedToken.uid}@user.local`;
    req.dbUser = await getOrCreateUser(decodedToken.uid, email, decodedToken.name ?? null);
  } catch {
    // Ignore invalid optional token for public endpoints
  }
  next();
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.dbUser || req.dbUser.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator privileges required.' });
  }
  next();
};
