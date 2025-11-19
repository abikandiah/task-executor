import cors from 'cors';
import express, { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
// import compression from 'compression';
import rateLimit, { Options } from 'express-rate-limit';
import getVersionRouter from 'utils/versionRouter.js';
import { config } from './config/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { logger, morganMiddleware } from './utils/logger.js';


const __filename = fileURLToPath(import.meta.url);
const app: Express = express();

// ============================================
// ESSENTIAL CONFIGURATION
// ============================================

// Trust proxy - important for rate limiting and getting correct IPs behind reverse proxies
// Trust proxy - CRITICAL for Cloudflare
app.set('trust proxy', 1);

// Security headers via Helmet
app.use(helmet({
	contentSecurityPolicy: config.isProduction ? {
		directives: {
			defaultSrc: ["'self'"],
			styleSrc: ["'self'", "'unsafe-inline'"],
			scriptSrc: ["'self'"],
			imgSrc: ["'self'", "data:", "https:"],
		},
	} : false, // Disable CSP in development for easier debugging

	hsts: {
		maxAge: 31536000, // 1 year
		includeSubDomains: true,
		preload: true,
	},

	frameguard: { action: "deny" }, // Prevent clickjacking
	hidePoweredBy: true, // Hide Express
}));

// CORS configuration
app.use(cors({
	origin: config.cors.origin,
	credentials: true, // Allow cookies/auth headers
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
	exposedHeaders: ['X-Total-Count', 'X-Page-Number'], // For pagination
	maxAge: 86400, // Cache preflight for 24 hours
}));

// ============================================
// BODY PARSING
// ============================================

app.use(express.json({
	limit: '10mb',
	// Store raw body for webhook signature verification if needed
	verify: (req, res, buf) => {
		(req as any).rawBody = buf.toString('utf8');
	},
}));

app.use(express.urlencoded({
	extended: true,
	limit: '10mb',
}));

// app.use(compression());

// ============================================
// LOGGING
// ============================================

app.use(morganMiddleware);

// ============================================
// ROUTES
// ============================================

// Health check endpoint (for monitoring/load balancers)
app.get('/health', (req: Request, res: Response) => {
	res.status(200).json({
		status: 'ok',
		environment: config.env,
		app: config.app.name,
		version: config.app.version,
		apiVersion: config.api.currentVersion,
		timestamp: new Date().toISOString(),
		uptime: Math.floor(process.uptime()),
	});
});

// Version info endpoint
app.get('/api/version', (req, res) => {
	res.json({
		current: config.api.currentVersion,
		supported: config.api.supportedVersions,
		versions: config.api.versions
	});
});

// Readiness check (for K8s readiness probes)
app.get('/ready', (req: Request, res: Response) => {
	// Add checks for database, Redis, etc.
	// For now, just return ok
	res.status(200).json({ status: 'ready' });
});

// API routes
config.api.supportedVersions.forEach(version => {
	const versionConfig = config.api.versions[version];
	const router = getVersionRouter(version);

	if (!versionConfig) {
		logger.error(`Version config not found for: ${version}`);
		return;
	}
	if (!versionConfig?.rateLimit) {
		logger.error(`Invalid config for version: ${version}`);
		return;
	}

	const limiter: Partial<Options> = {
		message: {
			status: 'error',
			message: 'Too many requests, please try again later.'
		},
		standardHeaders: true, // Return rate limit info in headers
		legacyHeaders: false,
		validate: {
			trustProxy: true
		}
	};

	// General API rate limiting
	const apiLimiter = rateLimit({
		...versionConfig.rateLimit,
		...limiter,
		skip: (req) => req.path === '/health', // Don't rate limit health checks
		handler: (req, res) => {
			const ip = req.headers['cf-connecting-ip'] || req.ip;
			logger.warn(`Rate limit exceeded for IP: ${ip} on ${req.path}`);
			res.status(429).json({
				status: 'error',
				message: 'Too many requests, please try again later.',
			});
		},
	});

	// Stricter rate limiting for authentication endpoints
	// Technically no need due to Authentik + Caddy setup, but good to have defense in depth
	const authLimiter = rateLimit({
		windowMs: 15 * 60 * 1000,
		max: 5,
		...limiter,
		skipSuccessfulRequests: true, // Only count failed requests
	});

	const reqHandler = (req: Request, res: Response, next: NextFunction) => {
		if (versionConfig.deprecated) {
			res.setHeader('X-API-Deprecation', 'true');
			res.setHeader('X-API-Sunset', versionConfig?.sunsetDate || 'TBD');
			res.setHeader('X-API-Deprecation-Info', versionConfig?.message || 'This version is deprecated');
			logger.warn(`Deprecated v1 API accessed: ${req.method} ${req.path} from ${req.ip}`);
		}
		next();
	};

	app.use(`/api/${version}/auth`, authLimiter);
	app.use(`/api/${version}`, reqHandler, apiLimiter, router);
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req: Request, res: Response) => {
	logger.warn(`404 - Route not found: ${req.method} ${req.path}`);
	res.status(404).json({
		status: 'error',
		message: `Route ${req.originalUrl} not found`,
	});
});

// Global error handler (must be last)
app.use(errorHandler);

// ============================================
// PROCESS HANDLERS
// ============================================

let server: any;

// Graceful shutdown handler
const gracefulShutdown = (signal: string) => {
	logger.info(`${signal} received, starting graceful shutdown...`);

	if (!server) {
		logger.info('Server not started, exiting immediately');
		process.exit(0);
	}

	server.close(() => {
		logger.info('HTTP server closed');

		// Close database connections, Redis, etc.
		// Example:
		// await db.close();
		// await redis.quit();

		logger.info('All connections closed, exiting');
		process.exit(0);
	});

	// Force close after 10 seconds
	setTimeout(() => {
		logger.error('Could not close connections in time, forcing shutdown');
		process.exit(1);
	}, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled promise rejections
process.on('unhandledRejection', (reason: Error | any, promise: Promise<any>) => {
	logger.error('Unhandled Promise Rejection:', {
		reason: reason?.message || reason,
		stack: reason?.stack,
		promise,
	});
	// In production, you might want to exit
	if (config.isProduction) {
		process.exit(1);
	}
});

// Uncaught exceptions
process.on('uncaughtException', (error: Error) => {
	logger.error('Uncaught Exception:', {
		message: error.message,
		stack: error.stack,
	});
	process.exit(1);
});


// ============================================
// START SERVER
// ============================================

// Only start server if this file is run directly (not imported for testing)
if (process.argv[1] === __filename) {
	const PORT = config.port;

	server = app.listen(PORT, () => {
		logger.info('='.repeat(50));
		logger.info(`🚀 Server started successfully`);
		logger.info(`📍 Port: ${PORT}`);
		logger.info(`🌍 Environment: ${config.env}`);
		logger.info(`📊 API Version: ${config.api.currentVersion}`);

		// Show rate limits per version
		config.api.supportedVersions.forEach(version => {
			const cfg = config.api.versions[version];
			const status = cfg.deprecated ? '⚠️ (deprecated)' : '✅';
			logger.info(`🚦 ${version}: ${cfg.rateLimit.max}/15min ${status}`);
		});

		logger.info(`🔒 Security: Helmet enabled`);
		logger.info(`🌐 CORS: ${config.cors.origin.join(', ')}`);
		logger.info(`☁️ Compression: Handled by Cloudflare`);
		logger.info(`📝 Logging: ${config.logging.level}`);
		logger.info('='.repeat(50));
	});

	// Handle server startup errors
	server.on('error', (error: NodeJS.ErrnoException) => {
		if (error.code === 'EADDRINUSE') {
			logger.error(`Port ${PORT} is already in use`);
		} else if (error.code === 'EACCES') {
			logger.error(`❌ Permission denied to bind to port ${PORT}`);
		} else {
			logger.error('Server error:', error);
		}
		process.exit(1);
	});
}

// Export the app instance for testing
export default app;

