import { Module, Logger } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as net from 'net';

let sharedMemoryServer: any = null;

async function checkPortReachable(host: string, port: number, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('DatabaseModule');
        const nodeEnv = configService.get<string>('NODE_ENV') || process.env.NODE_ENV || 'development';
        let uri = configService.get<string>('MONGODB_URI') || process.env.MONGODB_URI;

        // 1. Production mode (NODE_ENV=production with a valid MONGODB_URI set):
        // Connect directly to the real MongoDB URI without touching or importing mongodb-memory-server
        if (nodeEnv === 'production') {
          if (!uri) {
            throw new Error('MONGODB_URI environment variable is required in production');
          }
          const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
          logger.log(`[Production] Connecting directly to external MongoDB: ${maskedUri}`);
          return {
            uri,
            autoIndex: false,
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000,
            socketTimeoutMS: 45000,
          };
        }

        // 2. Non-production with a valid external/cloud MongoDB URI:
        if (uri && !uri.includes('localhost:27017') && !uri.includes('127.0.0.1:27017')) {
          const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
          logger.log(`Connecting to specified MongoDB instance: ${maskedUri}`);
          return {
            uri,
            autoIndex: true,
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000,
            socketTimeoutMS: 45000,
          };
        }

        // 3. Local development: Only runs when NODE_ENV is development (or non-production) AND no external MONGODB_URI is provided
        const isReachable = await checkPortReachable('127.0.0.1', 27017, 800);
        if (isReachable) {
          uri = uri || 'mongodb://localhost:27017/procurement_coord_dev';
          logger.log(`Local standalone MongoDB detected at ${uri}`);
        } else {
          // Dynamic lazy import - only executed in local development when no real MongoDB instance is available.
          // This ensures production builds (which omit devDependencies) never load or require mongodb-memory-server.
          logger.warn('External MongoDB on localhost:27017 unreachable. Initializing embedded MongoMemoryServer fallback for local development...');
          const { MongoMemoryServer } = await import('mongodb-memory-server');
          if (!sharedMemoryServer) {
            sharedMemoryServer = await MongoMemoryServer.create({
              instance: {
                dbName: 'procurement_coord_dev',
              },
            });
          }
          uri = sharedMemoryServer.getUri();
          logger.log(`Embedded development MongoDB started successfully: ${uri}`);
        }

        return {
          uri,
          autoIndex: true,
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 10000,
          socketTimeoutMS: 45000,
        };
      },
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
