import request from 'supertest';
import app from '../src/server'; // Import the exported Express app

describe('GET /', () => {
  it('should return 200 and a welcome message', async () => {
    // Use Supertest to make a request to the app instance
    const response = await request(app).get('/');
    
    // Assertions
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: 'Hello, TypeScript Express Server!' });
  });
});
