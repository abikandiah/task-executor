import { config } from 'config/index.js';
import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
	statusCode: number;
	isOperational: boolean;

	constructor(message: string, statusCode: number) {
		super(message);
		this.statusCode = statusCode;
		this.isOperational = true;

		Error.captureStackTrace(this, this.constructor);
	}
}

export const errorHandler = (
	err: Error | AppError,
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	let statusCode = 500;
	let message = 'Internal Server Error';

	if (err instanceof AppError) {
		statusCode = err.statusCode;
		message = err.message;
	}

	logger.error({
		message: err.message,
		stack: err.stack,
		url: req.url,
		method: req.method,
		ip: req.ip,
		statusCode,
		apiVersion: req.path.match(/v\d+/)?.[0] || config.api.currentVersion,
	});

	// Don't leak error details in production
	const responseMessage = config.isProduction && statusCode === 500
		? 'Internal Server Error'
		: message;

	const response = {
		status: 'error',
		statusCode,
		message: responseMessage,
		apiVersion: config.api.currentVersion,
		// In dev, include more details
		...(config.isDevelopment && {
			stack: err.stack,
			appVersion: config.app.version,
		}),
	};

	res.status(statusCode).json(response);
};
