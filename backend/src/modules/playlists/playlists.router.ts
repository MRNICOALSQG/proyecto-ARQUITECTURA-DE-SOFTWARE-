import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import * as playlistsController from './playlists.controller';

const router = Router();

router.get('/', authenticate, playlistsController.listPlaylists);
router.post('/', authenticate, playlistsController.createPlaylist);
router.put('/:id', authenticate, playlistsController.updatePlaylist);
router.delete('/:id', authenticate, playlistsController.deletePlaylist);
router.get('/:id/songs', authenticate, playlistsController.listPlaylistSongs);
router.post('/:id/songs', authenticate, playlistsController.addSongToPlaylist);
router.delete('/:id/songs/:songId', authenticate, playlistsController.removeSongFromPlaylist);

export default router;
