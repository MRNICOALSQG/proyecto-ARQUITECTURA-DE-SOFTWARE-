import fs from 'fs';
import http from 'http';
import path from 'path';
import app from './app';
import { env } from './config/env';
import { pool } from './config/database';

const UPLOAD_SUBDIRECTORIES = ['songs', 'covers', 'images'] as const;
const DB_RETRY_ATTEMPTS = 5;
const DB_RETRY_DELAY_MS = 1_000;

let httpServer: http.Server | null = null;
let shuttingDown = false;

// Create the uploads tree (root + one directory per asset type).
function ensureUploadDirectories(): void {
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
  for (const directory of UPLOAD_SUBDIRECTORIES) {
    fs.mkdirSync(path.join(env.UPLOAD_DIR, directory), { recursive: true });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Verify the database with a lightweight query, retrying a bounded number of times.
export async function waitForDatabase(
  attempts: number = DB_RETRY_ATTEMPTS,
  delayMs: number = DB_RETRY_DELAY_MS
): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await pool.query('SELECT 1');
      console.log(`Database is available (attempt ${attempt}/${attempts})`);
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
      console.warn(
        `Database is not available (attempt ${attempt}/${attempts}). Retrying in ${delayMs}ms...`
      );
      await delay(delayMs);
    }
  }
}

function listen(): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(env.PORT, () => {
      server.off('error', reject);
      resolve(server);
    });
    server.once('error', reject);
  });
}

export async function startServer(): Promise<http.Server> {
  ensureUploadDirectories();
  await waitForDatabase();
  httpServer = await listen();
  console.log(`Rin'ne Backend running on http://localhost:${env.PORT}`);
  return httpServer;
}

async function closeHttpServer(): Promise<void> {
  if (!httpServer) {
    return;
  }

  const server = httpServer;
  httpServer = null;

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  console.log('HTTP server closed');
}

// Close the HTTP server and the database pool exactly once.
export async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`Received ${signal}. Shutting down gracefully...`);

  try {
    await closeHttpServer();
    await pool.end();
    console.log('Database pool closed');
    console.log('Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

if (require.main === module) {
  startServer().catch(async (error) => {
    console.error("Failed to start Rin'ne backend:", error);
    try {
      await pool.end();
    } catch {
      // The pool may not have opened any connection; ignore cleanup errors.
    }
    process.exit(1);
  });
}
