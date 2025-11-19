import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types/index.d.js';


function authMiddleware(req: Request, res: Response, next: NextFunction): void {
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
		if (process.env.NODE_ENV === 'development') {
			if (!process.env.DEV_SECRET) {
				throw new Error('DEV_SECRET not configured.');
			}
			if (token !== process.env.DEV_SECRET) {
				throw new Error('Token does not match development secret.');
			}

			req.user = {
				id: 'dev-user-id',
				email: 'dev@example.com',
				role: 'admin',
			};
		} else {
			// Validate JWT token
			if (!process.env.AUTHENTIK_SECRET) {
				throw new Error('AUTHENTIK_SECRET not configured.');
			}

			const decoded = jwt.verify(token, process.env.AUTHENTIK_SECRET) as JwtPayload;
			req.user = decoded;
		}

		next();

	} catch (ex) {
		res.status(400).json({ message: 'Invalid token.' });
	}
}

export default authMiddleware;

