import { Router } from 'express';
import authMiddleware from '../../middlewares/authMiddleware.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
	res.json({ message: 'Welcome to the protected API root!' });
});

export default router;
