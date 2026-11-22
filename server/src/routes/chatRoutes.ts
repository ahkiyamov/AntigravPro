import { Router } from 'express';
import {
  getRooms,
  getRoomMessages,
  createDirectRoom,
  createGroupRoom,
} from '../controllers/chatController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = Router();

router.get('/rooms', authenticateToken, getRooms);
router.get('/rooms/:roomId/messages', authenticateToken, getRoomMessages);
router.post('/rooms/direct', authenticateToken, createDirectRoom);
router.post('/rooms/group', authenticateToken, createGroupRoom);

export default router;
