import { Router } from 'express';
import { getUsers, registerPushToken } from '../controllers/userController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticateToken, getUsers);
router.post('/push-token', authenticateToken, registerPushToken);

export default router;
