import { authController } from 'controllers/auth.controller.js';
import { Router } from 'express';
import { asyncHandler } from 'utils/asyncHandler.js';

const router = Router();

router.post('/login', asyncHandler, authController.login);
router.post('/logout', asyncHandler, authController.logout);
router.get('/register', asyncHandler, authController.register);

export default router;

