import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';


// Load environment variables
dotenv.config();

// Load package.json for app metadata
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
	readFileSync(join(__dirname, '../../package.json'), 'utf8')
);

// ============================================
// ENVIRONMENT SCHEMA
// ============================================

const envSchema = z.object({
	// Environment
	NODE_ENV: z
		.enum(['development', 'production', 'test'])
		.default('development'),

	PORT: z
		.string()
		.default('3000')
		.transform((val) => parseInt(val, 10))
		.pipe(z.number().min(1).max(65535)),

	// API Configuration
	API_VERSION: z
		.string()
		.regex(/^v\d+$/, 'API_VERSION must be in format: v1, v2, etc.')
		.default('v1'),

	// CORS
	CORS_ORIGIN: z
		.string()
		.default('http://localhost:3000')
		.transform((val) => val.split(',').map(origin => origin.trim())),

	// JWT
	JWT_SECRET: z
		.string()
		.min(32, 'JWT_SECRET must be at least 32 characters'),

	JWT_EXPIRES_IN: z
		.string()
		.regex(/^\d+[smhd]$/, 'JWT_EXPIRES_IN must be like: 60s, 15m, 24h, 7d')
		.default('24h'),

	// Authentication
	AUTHENTIK_SECRET: z
		.string()
		.optional(),

	DEV_SECRET: z
		.string()
		.optional(),

	// Logging
	LOG_LEVEL: z
		.enum(['error', 'warn', 'info', 'http', 'debug'])
		.default('info'),

	// CI/CD metadata (optional)
	BUILD_NUMBER: z
		.string()
		.optional(),

	COMMIT_SHA: z
		.string()
		.optional(),

	BRANCH: z
		.string()
		.optional(),

	// Database (if you add later)
	DATABASE_URL: z
		.string()
		.optional(),

	// Redis (if you add later)
	REDIS_URL: z
		.string()
		.optional(),
});

// ============================================
// VALIDATE & PARSE ENVIRONMENT
// ============================================

const parseEnv = () => {
	try {
		return envSchema.parse(process.env);
	} catch (error) {
		console.log('?')
		if (error instanceof z.ZodError) {
			console.error('❌ Invalid environment variables:\n');
			error.issues.forEach((issue) => {
				console.error(`  • ${issue.path.join('.')}: ${issue.message}`);
			});
			console.error('\nPlease check your .env file.\n');
			process.exit(1);
		}
		throw error;
	}
};

const env = parseEnv();

// ============================================
// API VERSIONING SCHEMA
// ============================================

const versionConfigSchema = z.object({
	deprecated: z.boolean(),
	sunsetDate: z.string().optional(),
	message: z.string().optional(),
	rateLimit: z.object({
		windowMs: z.number().positive(),
		max: z.number().positive(),
	}),
});

const apiVersionsSchema = z.object({
	v1: versionConfigSchema,
	v2: versionConfigSchema,
});

type VersionConfig = z.infer<typeof versionConfigSchema>;
type ApiVersions = z.infer<typeof apiVersionsSchema>;

// ============================================
// CONFIG OBJECT
// ============================================

const apiVersions: ApiVersions = {
	v1: {
		deprecated: false,
		// sunsetDate: '2026-12-31',
		// message: 'API v1 is deprecated. Please migrate to v2 by December 31, 2026.',
		rateLimit: {
			windowMs: 15 * 60 * 1000, // 15 minutes
			max: 1000, // Lower limit for deprecated version
		},
	},
	v2: {
		deprecated: false,
		rateLimit: {
			windowMs: 15 * 60 * 1000, // 15 minutes
			max: 1000,
		},
	},
};

// Validate API versions config
apiVersionsSchema.parse(apiVersions);

export const config = {
	// Application metadata
	app: {
		name: packageJson.name as string,
		version: packageJson.version as string,
		description: (packageJson.description as string) || '',
		buildNumber: env.BUILD_NUMBER || 'local',
		commitSha: env.COMMIT_SHA?.substring(0, 7) || 'unknown',
		branch: env.BRANCH || 'unknown',
	},

	// Environment
	env: env.NODE_ENV,
	port: env.PORT,
	isProduction: env.NODE_ENV === 'production',
	isDevelopment: env.NODE_ENV === 'development',
	isTest: env.NODE_ENV === 'test',

	// API versioning
	api: {
		currentVersion: env.API_VERSION,
		supportedVersions: ['v1'] as const,
		versions: apiVersions,
	},

	// CORS
	cors: {
		origin: env.CORS_ORIGIN,
	},

	// JWT
	jwt: {
		secret: env.JWT_SECRET,
		expiresIn: env.JWT_EXPIRES_IN,
	},

	// Authentication
	auth: {
		authentikSecret: env.AUTHENTIK_SECRET,
		devSecret: env.DEV_SECRET,
	},

	// Logging
	logging: {
		level: env.LOG_LEVEL,
	},

	// Database (optional)
	database: env.DATABASE_URL ? {
		url: env.DATABASE_URL,
		pool: {
			min: 2,
			max: 10,
		},
	} : undefined,

	// Redis (optional)
	redis: env.REDIS_URL ? {
		url: env.REDIS_URL,
	} : undefined,
} as const;

// ============================================
// PRODUCTION VALIDATION
// ============================================

if (config.isProduction) {
	// Required in production
	const requiredInProduction = [
		{ key: 'JWT_SECRET', value: env.JWT_SECRET },
		{ key: 'AUTHENTIK_SECRET', value: env.AUTHENTIK_SECRET },
	];

	const missing = requiredInProduction.filter(({ value }) => !value);

	if (missing.length > 0) {
		console.error('❌ Missing required production environment variables:');
		missing.forEach(({ key }) => console.error(`  - ${key}`));
		process.exit(1);
	}

	// Warnings for production
	if (config.cors.origin.includes('*')) {
		console.warn('⚠️ WARNING: CORS is set to allow all origins (*)');
	}

	if (config.cors.origin.some(origin => origin.includes('localhost'))) {
		console.warn('⚠️ WARNING: CORS includes localhost in production');
	}
}

// ============================================
// DEVELOPMENT WARNINGS
// ============================================

if (config.isDevelopment) {
	if (!env.DEV_SECRET) {
		console.warn('⚠️ DEV_SECRET not set.');
	}
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export const getVersionConfig = (version: string): VersionConfig | undefined => {
	return config.api.versions[version as keyof ApiVersions];
};

export const isVersionSupported = (version: string): boolean => {
	return config.api.supportedVersions.includes(version as any);
};

export const isVersionDeprecated = (version: string): boolean => {
	const versionConfig = getVersionConfig(version);
	return versionConfig?.deprecated ?? false;
};

// ============================================
// TYPE EXPORTS
// ============================================

export type Config = typeof config;
export type Environment = z.infer<typeof envSchema>;
export type { ApiVersions, VersionConfig };

// ============================================
// STARTUP LOGGING
// ============================================

if (config.isDevelopment) {
	console.log('📦 Configuration loaded:');
	console.log(`  - App: ${config.app.name} v${config.app.version}`);
	console.log(`  - Environment: ${config.env}`);
	console.log(`  - Port: ${config.port}`);
	console.log(`  - API Version: ${config.api.currentVersion}`);
	console.log(`  - CORS Origins: ${config.cors.origin.join(', ')}`);
	console.log(`  - Log Level: ${config.logging.level}`);
	console.log(`  - Build: ${config.app.buildNumber} (${config.app.commitSha})`);
}

