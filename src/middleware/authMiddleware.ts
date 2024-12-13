import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload, VerifyErrors } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

interface CustomRequest extends Request {
  user?: JwtPayload;
}

export const authenticateToken = (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Token tidak ditemukan",
    });
  }

  jwt.verify(token, JWT_SECRET, (err: VerifyErrors | null, decoded: JwtPayload | string | undefined) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: "Token tidak valid",
      });
    }

    // Ensure decoded is an object
    if (typeof decoded === "object" && decoded !== null) {
      req.user = decoded as JwtPayload;
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: "Token tidak valid",
      });
    }
  });
};
