import { Module, Logger } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as net from 'net';
import { MongoMemoryServer } from 'mongodb-memory-server';

let sharedMemoryServer: MongoMemoryServer | null = null;

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
        let uri = configService.get<string>('MONGODB_URI');

        if (!uri || uri.includes('localhost:27017')) {
          const isReachable = await checkPortReachable('127.0.0.1', 27017, 800);
          if (!isReachable) {
            logger.warn('External MongoDB on localhost:27017 unreachable. Initializing embedded MongoMemoryServer for seamless zero-dependency operation...');
            if (!sharedMemoryServer) {
              sharedMemoryServer = await MongoMemoryServer.create({
                instance: {
                  dbName: 'procurement_coord_dev',
                },
              });
            }
            uri = sharedMemoryServer.getUri();
            logger.log(`Embedded MongoDB started successfully: ${uri}`);
          } else {
            uri = 'mongodb://localhost:27017/procurement_coord_dev';
          }
        }

        return {
          uri,
          autoIndex: true,
        };
      },
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}

