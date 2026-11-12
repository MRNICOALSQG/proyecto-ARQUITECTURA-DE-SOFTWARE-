import { NextFunction, Request, Response, Router } from 'express';
import { createUploader } from '../shared/uploads';
import { HttpError } from '../shared/http-error';
import { authenticate } from '../middleware/auth';

const router = Router();

const upload = createUploader({
  folder: 'images',
  allowedMimeTypes: (mimetype) => mimetype.startsWith('image/'),
  maxFileSize: 5 * 1024 * 1024, // 5MB
  invalidTypeMessage: 'Formato de imagen no compatible',
});

// POST /api/upload/image
router.post(
  '/image',
  authenticate,
  upload.single('image'),
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      next(new HttpError(400, 'No se proporcionó imagen'));
      return;
    }

    const fileUrl = `/uploads/images/${req.file.filename}`;
    res.json({ url: fileUrl });
  }
);

export default router;
