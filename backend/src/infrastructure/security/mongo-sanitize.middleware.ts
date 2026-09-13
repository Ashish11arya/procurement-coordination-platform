import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  const cleanObj: Record<string, any> = {};

  for (const [key, val] of Object.entries(obj)) {
    // Strip keys starting with $ (MongoDB query operators like $gt, $ne, $where) or containing dots
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }

    cleanObj[key] = sanitizeObject(val);
  }

  return cleanObj;
}

@Injectable()
export class MongoSanitizeMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }
    next();
  }
}
