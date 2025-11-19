import { Request } from 'express';

// Define the expected Jwt token payload structure
export interface JwtPayload {
	id: string;
	email: string;
	role: string;
}

// Augment the 'express' module
declare module 'express' {
	interface Request {
		user?: JwtPayload;
	}
}
