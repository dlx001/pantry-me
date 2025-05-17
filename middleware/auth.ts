import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
      };
    }
  }
}
interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
  };
}

export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.sendStatus(401);
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err, user) => {
    if (err) {
      res.sendStatus(403);
      return;
    }

    // Type assertion here
    (req as AuthenticatedRequest).user = user as { userId: number };
    next();
  });
}
