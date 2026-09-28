import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  created_at: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export function generateToken(userId: string): { token: string; jti: string } {
  const jti = uuidv4();
  const token = jwt.sign(
    { sub: userId, jti },
    process.env.JWT_SECRET || 'fallback-secret',
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      algorithm: 'HS256',
    }
  );
  return { token, jti };
}

export function decodeToken(token: string): any {
  return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', {
    algorithms: ['HS256'],
  });
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('jwt', { session: false }, (err: any, user: AuthUser | false) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    (req as AuthRequest).user = user;
    next();
  })(req, res, next);
};
