import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import * as authController from './auth.controller';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);
router.put('/profile', authenticate, authController.updateProfile);

export default router;
