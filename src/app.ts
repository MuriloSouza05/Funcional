import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { prisma } from './config/database';

// Import routes
import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import clientsRoutes from './routes/clients';
import projectsRoutes from './routes/projects';
import tasksRoutes from './routes/tasks';
import transactionsRoutes from './routes/transactions';
import invoicesRoutes from './routes/invoices';
import adminRoutes from './routes/admin';

export function createApp() {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));

  // CORS configuration
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: {
      error: 'Too many requests',
      retryAfter: '15 minutes',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });
    
    next();
  });

  // Health check endpoint
  app.get('/health', async (req, res) => {
    try {
      // Test database connection
      await prisma.$queryRaw`SELECT 1`;
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'connected',
          server: 'running',
        },
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  });

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/clients', clientsRoutes);
  app.use('/api/projects', projectsRoutes);
  app.use('/api/tasks', tasksRoutes);
  app.use('/api/transactions', transactionsRoutes);
  app.use('/api/invoices', invoicesRoutes);
  app.use('/api/admin', adminRoutes);

  // Global error handler
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Global error handler:', error);

    // Log error to database
    prisma.systemLog.create({
      data: {
        level: 'error',
        message: error.message,
        metadata: {
          stack: error.stack,
          path: req.path,
          method: req.method,
          body: req.body,
          query: req.query,
          headers: req.headers,
        },
      },
    }).catch(console.error);

    res.status(error.status || 500).json({
      error: error.message || 'Internal server error',
      code: error.code || 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Endpoint not found',
      path: req.originalUrl,
      method: req.method,
    });
  });

  return app;
}