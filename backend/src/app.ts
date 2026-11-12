import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import passport from 'passport';
import { env } from './config/env';
import { pool } from './config/database';
import { configurePassport } from './config/passport';
import { errorHandler } from './middleware/errores';
import authRoutes from './modules/auth/auth.router';
import songsRoutes from './modules/songs/songs.router';
import preferencesRoutes from './modules/preferences/preferences.router';
import playlistsRoutes from './modules/playlists/playlists.router';
import favoritesRoutes from './modules/favorites/favorites.router';
import uploadRoutes from './routes/upload.routes';

export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Passport
  configurePassport(passport);
  app.use(passport.initialize());

  // Static files for uploads
  app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/songs', songsRoutes);
  app.use('/api/preferences', preferencesRoutes);
  app.use('/api/playlists', playlistsRoutes);
  app.use('/api/favorites', favoritesRoutes);
  app.use('/api/upload', uploadRoutes);

  // Health check
  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(503).json({ status: 'error', db: 'error', version: env.APP_VERSION });
      return;
    }

    res.json({ status: 'ok', db: 'ok', version: env.APP_VERSION });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}

const app: Express = createApp();

export default app;
