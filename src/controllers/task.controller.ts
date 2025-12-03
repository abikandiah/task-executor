import { NextFunction, Request, Response } from 'express';

class TaskController {
	public async getTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
		// TODO: get tasks from database
		res.json({ tasks: [] });
	}

	public async createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
		
	}
}

export const taskController = new TaskController();
