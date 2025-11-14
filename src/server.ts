import express, { Request, Response } from 'express';

// Separate app definition from server start for easier testing
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Main App Route
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ message: 'Hello, TypeScript Express Server!' });
});

// Start the server only if the file is run directly (not imported for testing)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
  });
}

// Export the app instance for testing
export default app;
