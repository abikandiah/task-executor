import morgan from 'morgan';
import winston from 'winston';
import { config } from '../config/index.js';

// Winston Logger Configuration
const logFormat = winston.format.combine(
	winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
	winston.format.errors({ stack: true }),
	winston.format.splat(),
	winston.format.json()
);

const consoleFormat = winston.format.combine(
	winston.format.colorize(),
	winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
	winston.format.printf(({ timestamp, level, message, ...meta }) => {
		return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
			}`;
	})
);

export const logger = winston.createLogger({
	level: config.logging.level,
	format: logFormat,
	transports: [
		new winston.transports.Console({
			format: config.env === 'development' ? consoleFormat : logFormat,
		}),
		new winston.transports.File({
			filename: 'logs/error.log',
			level: 'error',
			maxsize: 5242880, // 5MB
			maxFiles: 5,
		}),
		new winston.transports.File({
			filename: 'logs/combined.log',
			maxsize: 5242880, // 5MB
			maxFiles: 5,
		}),
	],
});

// Morgan Middleware with Winston
const stream = {
	write: (message: string) => {
		logger.http(message.trim());
	},
};

export const morganMiddleware = morgan(
	':remote-addr :method :url :status :res[content-length] - :response-time ms',
	{ stream }
);

