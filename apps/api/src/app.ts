import express, { type Express, Router } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { config } from './config.js';
import { errorHandler, notFound } from './lib/http.js';
import { attachAuth } from './middleware/auth.js';
import { csrfProtection } from './middleware/csrf.js';
import { healthRouter } from './modules/health/routes.js';
import { authRouter } from './modules/auth/routes.js';
import { usersRouter } from './modules/users/routes.js';
import { rolesRouter } from './modules/roles/routes.js';
import { organizationRouter } from './modules/organization/routes.js';
import { employeesRouter } from './modules/employees/routes.js';
import { questionsRouter } from './modules/questions/routes.js';
import { formsRouter } from './modules/forms/routes.js';
import { cyclesRouter } from './modules/cycles/routes.js';
import { evaluationsRouter, improvementPlansRouter } from './modules/evaluations/routes.js';
import { compensationRouter } from './modules/compensation/routes.js';
import { reportsRouter } from './modules/reports/routes.js';
import { aiRouter } from './modules/ai/routes.js';
import { helpRouter } from './modules/help/routes.js';
import { ticketsRouter } from './modules/tickets/routes.js';
import { processesRouter } from './modules/processes/routes.js';
import { agreementsRouter } from './modules/agreements/routes.js';
import { adminRouter } from './modules/admin/routes.js';
import { jobsRouter } from './modules/jobs/routes.js';

/**
 * Builds the Express application (no network listen here, so tests can import
 * it directly with supertest).
 */
export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // This is a JSON API; a strict CSP is applied at the web/reverse-proxy tier.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  app.use(cors({ origin: [config.APP_URL], credentials: true }));

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false, limit: '2mb' }));
  app.use(cookieParser());

  if (!config.isTest) {
    app.use(
      pinoHttp({
        redact: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-csrf-token"]'],
        autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
      }),
    );
  }

  // Double-submit CSRF for all mutating requests (bearer/webhook paths exempt).
  app.use(csrfProtection);

  // Resolve the session once, for every route.
  app.use(attachAuth);

  const api = Router();
  api.use(healthRouter);
  api.use('/auth', authRouter);
  api.use('/users', usersRouter);
  api.use('/roles', rolesRouter);
  api.use('/organization', organizationRouter);
  api.use('/employees', employeesRouter);
  api.use('/questions', questionsRouter);
  api.use('/forms', formsRouter);
  api.use('/evaluation-cycles', cyclesRouter);
  api.use('/evaluations', evaluationsRouter);
  api.use('/improvement-plans', improvementPlansRouter);
  api.use('/compensation', compensationRouter);
  api.use('/reports', reportsRouter);
  api.use('/ai', aiRouter);
  api.use('/help', helpRouter);
  api.use('/tickets', ticketsRouter);
  api.use('/processes', processesRouter);
  api.use('/agreements', agreementsRouter);
  api.use('/admin', adminRouter);
  api.use('/jobs', jobsRouter);

  app.use('/api/v1', api);

  // Unknown API routes → JSON 404 (never an HTML page from an API).
  app.use('/api', (_req, _res, next) => next(notFound('مسیر مورد نظر یافت نشد.')));

  app.use(errorHandler);

  return app;
}
