import { NextFunction, Request, Response } from 'express';

class AuthController {
	public async login(req: Request, res: Response, next: NextFunction): Promise<void> {

	}

	public async logout(req: Request, res: Response, next: NextFunction): Promise<void> {

	}

	public async register(req: Request, res: Response, next: NextFunction): Promise<void> {

	}
}

export const authController = new AuthController();

