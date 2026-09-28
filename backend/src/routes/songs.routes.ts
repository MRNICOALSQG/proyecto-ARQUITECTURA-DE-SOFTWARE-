import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Multer config for song uploads
const uploadDir = process.env.UPLOAD_DIR || './uploads';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const songsDir = path.join(uploadDir, 'songs');
    if (!fs.existsSync(songsDir)) {
      fs.mkdirSync(songsDir, { recursive: true });
    }
    cb(null, songsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const allowedMimeTypes = [
  'audio/mpeg',
  'audio/mp3',
  'audio/flac',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/x-flac',
  'audio/aac',
  'audio/mp4',
  'video/mp4',
  'audio/x-m4a',
];

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800'), // 50MB
  },
  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato no compatible. Usa MP3, FLAC, OGG o WAV'));
    }
  },
});

// GET /api/songs - List user's songs
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;
    const searchQuery = req.query.search as string;

    let sql = 'SELECT * FROM songs WHERE user_id = $1';
    const params: any[] = [user.id];

    if (searchQuery) {
      sql += ' AND (LOWER(title) LIKE $2 OR LOWER(artist) LIKE $2)';
      params.push(`%${searchQuery.toLowerCase()}%`);
    }

    sql += ' ORDER BY uploaded_at DESC';

    const result = await query(sql, params);
    res.json({ songs: result.rows });
  } catch (error) {
    console.error('List songs error:', error);
    res.status(500).json({ error: 'Error al obtener canciones' });
  }
});

// POST /api/songs/upload - Upload one or more songs
router.post('/upload', authenticate, upload.array('audio', 20), async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No se proporcionó archivo de audio' });
    }

    const artist = req.body.artist || 'Unknown Artist';
    const album = req.body.album || 'Unknown Album';
    const safeArtist = artist.replace(/[<>;"'&]/g, '');
    const safeAlbum = album.replace(/[<>;"'&]/g, '');

    const insertedSongs = [];

    for (const file of files) {
      const title = path.parse(file.originalname).name;
      const safeTitle = title.replace(/[<>;"'&]/g, '');
      const filePath = `/uploads/songs/${file.filename}`;

      const result = await query(
        `INSERT INTO songs (user_id, title, artist, album, duration_seconds, file_path, file_size, mime_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [user.id, safeTitle, safeArtist, safeAlbum, 0, filePath, file.size, file.mimetype]
      );
      insertedSongs.push(result.rows[0]);
    }

    res.status(201).json({ songs: insertedSongs });
  } catch (error: any) {
    console.error('Upload error:', error);
    if (error.message?.includes('Formato no compatible')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error al subir la canción' });
  }
});

// GET /api/songs/:id/stream - Stream a song
router.get('/:id/stream', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;
    const songId = req.params.id;

    const result = await query(
      'SELECT * FROM songs WHERE id = $1 AND user_id = $2',
      [songId, user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Canción no encontrada' });
    }

    const song = result.rows[0];
    const absolutePath = path.resolve(song.file_path.replace('/uploads/', uploadDir + '/'));

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const stat = fs.statSync(absolutePath);
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;

      const stream = fs.createReadStream(absolutePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': song.mime_type || 'audio/mpeg',
      });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': song.mime_type || 'audio/mpeg',
      });
      fs.createReadStream(absolutePath).pipe(res);
    }
  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({ error: 'Error al reproducir la canción' });
  }
});

// PUT /api/songs/:id - Update a song
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;
    const songId = req.params.id;
    const { title, cover_path } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'El título es requerido' });
    }

    const safeTitle = title.replace(/[<>;"'&]/g, '');

    const result = await query(
      'UPDATE songs SET title = $1, cover_path = COALESCE($2, cover_path) WHERE id = $3 AND user_id = $4 RETURNING *',
      [safeTitle, cover_path || null, songId, user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Canción no encontrada' });
    }

    res.json({ song: result.rows[0] });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Error al actualizar la canción' });
  }
});

// DELETE /api/songs/:id - Delete a song
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;
    const songId = req.params.id;

    const result = await query(
      'SELECT * FROM songs WHERE id = $1 AND user_id = $2',
      [songId, user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Canción no encontrada' });
    }

    const song = result.rows[0];

    // Delete file from disk
    const absolutePath = path.resolve(song.file_path.replace('/uploads/', uploadDir + '/'));
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    // Delete cover if exists
    if (song.cover_path) {
      const coverPath = path.resolve(song.cover_path.replace('/uploads/', uploadDir + '/'));
      if (fs.existsSync(coverPath)) {
        fs.unlinkSync(coverPath);
      }
    }

    // Delete from database
    await query('DELETE FROM songs WHERE id = $1', [songId]);

    res.json({ message: 'Canción eliminada correctamente' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Error al eliminar la canción' });
  }
});

// Error handling for multer
router.use((err: any, _req: Request, res: Response, _next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo excede el tamaño máximo de 50MB' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;
