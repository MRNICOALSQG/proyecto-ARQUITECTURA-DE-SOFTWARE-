import { Router, Request, Response } from 'express';
import { createUploader } from '../shared/uploads';
import { authenticate } from '../middleware/auth';

const router = Router();

const upload = createUploader({
  folder: 'images',
  allowedMimeTypes: (mimetype) => mimetype.startsWith('image/'),
  maxFileSize: 5 * 1024 * 1024, // 5MB
  invalidTypeMessage: 'Formato de imagen no compatible',
});

// POST /api/upload/image
router.post('/image', authenticate, upload.single('image'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó imagen' });
    }
    const fileUrl = `/uploads/images/${req.file.filename}`;
    res.json({ url: fileUrl });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: 'Error al subir la imagen' });
  }
});

export default router;
