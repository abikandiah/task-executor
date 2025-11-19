import { config } from 'config/index.js';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types/index.d.js';


export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
	const authHeader = req.headers['authorization'];

	if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
		res.status(401).json({ message: 'Access denied. No token provided.' });
		return;
	}

	const token = authHeader.split(' ')[1];
	if (!token) {
		res.status(401).json({ message: 'Access denied. No token provided.' });
		return;
	}

	try {
		// Validate dev auth via .env secret
		if (config.isDevelopment) {
			if (!config.auth.devSecret) {
				throw new Error('Dev sercet not configured.');
			}
			if (token !== config.auth.devSecret) {
				throw new Error('Token does not match development secret.');
			}

			req.user = {
				id: 'dev-user-id',
				email: 'dev@example.com',
				role: 'admin',
			};
		} else {
			// Validate JWT token
			if (!config.auth.authentikSecret) {
				throw new Error('Authentik secret not configured.');
			}

			const decoded = jwt.verify(token, config.auth.authentikSecret) as JwtPayload;
			req.user = decoded;
		}

		next();

	} catch (ex) {
		res.status(400).json({ message: 'Invalid token.' });
	}
}

export default authMiddleware;

