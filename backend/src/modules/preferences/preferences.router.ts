import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import * as preferencesController from './preferences.controller';

const router: Router = Router();

router.get('/', authenticate, preferencesController.getPreferences);
router.put('/', authenticate, preferencesController.updatePreferences);

export default router;
