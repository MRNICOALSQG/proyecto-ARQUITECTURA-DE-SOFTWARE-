import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import * as songsController from './songs.controller';
import { uploadSongFiles } from './songs.upload';

const router = Router();

router.get('/', authenticate, songsController.listSongs);
router.post(
  '/upload',
  authenticate,
  uploadSongFiles.array('audio', 20),
  songsController.uploadSongs
);
router.get('/:id/stream', authenticate, songsController.streamSong);
router.put('/:id', authenticate, songsController.updateSong);
router.delete('/:id', authenticate, songsController.deleteSong);

export default router;
