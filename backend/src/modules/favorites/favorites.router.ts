import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import * as favoritesController from './favorites.controller';

const router = Router();

router.get('/', authenticate, favoritesController.listFavorites);
router.get('/check/:songId', authenticate, favoritesController.checkFavorite);
router.post('/:songId', authenticate, favoritesController.addFavorite);
router.delete('/:songId', authenticate, favoritesController.removeFavorite);

export default router;
