import { taskController } from 'controllers/task.controller.js';
import { Router } from 'express';
import { asyncHandler } from 'utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler, taskController.getTasks);
router.post('/submit', asyncHandler, taskController.createTask);

export default router;

