import { Router } from 'express';
import authMiddleware from '../../middlewares/authMiddleware.js';
import authRouter from './auth.routes.js';
import taskRouter from './task.routes.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
	res.json({ message: 'Welcome to the protected API root!' });
});

router.use('/auth', authRouter);
router.use('/tasks', taskRouter);

export default router;
