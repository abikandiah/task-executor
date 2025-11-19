import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import authMiddleware from './middlewares/authMiddleware.js';

// Load environment variables from .env file
dotenv.config();

// Separate app definition from server start for easier testing
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(authMiddleware);

// Main App Route
app.get('/', (req: Request, res: Response) => {
	res.status(200).json({ message: 'Hello, TypeScript Express Server!' });
});


// Start the server only if the file is run directly (not imported for testing)
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
	app.listen(PORT, () => {
		console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
	});
}

// Export the app instance for testing
export default app;

