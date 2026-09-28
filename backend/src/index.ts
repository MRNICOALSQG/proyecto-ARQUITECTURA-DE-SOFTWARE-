import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import passport from 'passport';
import { configurePassport } from './config/passport';
import { pool, testConnection } from './config/database';
import authRoutes from './routes/auth.routes';
import songsRoutes from './routes/songs.routes';
import preferencesRoutes from './routes/preferences.routes';
import playlistsRoutes from './routes/playlists.routes';
import favoritesRoutes from './routes/favorites.routes';
import uploadRoutes from './routes/upload.routes';

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(path.join(uploadDir, 'songs'))) {
  fs.mkdirSync(path.join(uploadDir, 'songs'), { recursive: true });
}
if (!fs.existsSync(path.join(uploadDir, 'covers'))) {
  fs.mkdirSync(path.join(uploadDir, 'covers'), { recursive: true });
}
if (!fs.existsSync(path.join(uploadDir, 'images'))) {
  fs.mkdirSync(path.join(uploadDir, 'images'), { recursive: true });
}

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Passport
configurePassport(passport);
app.use(passport.initialize());

// Static files for uploads
app.use('/uploads', express.static(path.resolve(uploadDir)));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/songs', songsRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/playlists', playlistsRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
async function start() {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`🎵 Rin'ne Backend running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);

export default app;
