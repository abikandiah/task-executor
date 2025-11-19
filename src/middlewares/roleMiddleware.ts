// src/middleware/roleMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';

export const requireRole = (roles: string[]) => {
	return (req: Request, res: Response, next: NextFunction) => {
		if (!req.user) {
			throw new AppError('Authentication required', 401);
		}

		if (!roles.includes(req.user.role)) {
			throw new AppError('Insufficient permissions', 403);
		}

		next();
	};
};
