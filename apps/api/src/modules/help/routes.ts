import { Router } from 'express';
import { helpArticleSchema, helpFaqSchema, helpGlossarySchema } from '@pe/validation';
import { db } from '../../db.js';
import { asyncHandler, notFound, sendData } from '../../lib/http.js';
import { recordAudit } from '../../lib/audit.js';
import { requirePermission, getAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/scope.js';
import { validateBody } from '../../middleware/validate.js';
import { faContains } from '../../lib/text.js';

export const helpRouter = Router();

/** Public help centre: resolves the active organization without a session. */
async function resolveOrgId(authOrgId: number | null | undefined): Promise<number | null> {
  if (authOrgId) return authOrgId;
  const org = await db.organization.findFirst({ where: { status: 'active' }, orderBy: { id: 'asc' } });
  return org?.id ?? null;
}

helpRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const orgId = await resolveOrgId(req.auth?.organizationId);
    if (!orgId) return sendData(res, { articles: [], faqs: [], glossary: [] });
    const [articles, faqs, glossary] = await Promise.all([
      db.helpArticle.findMany({ where: { organizationId: orgId, status: 'published' }, orderBy: { sortOrder: 'asc' } }),
      db.helpFaq.findMany({ where: { organizationId: orgId, status: 'published' }, orderBy: { sortOrder: 'asc' } }),
      db.helpGlossary.findMany({ where: { organizationId: orgId }, orderBy: { term: 'asc' } }),
    ]);
    sendData(res, { articles, faqs, glossary });
  }),
);

helpRouter.get(
  '/article/:slug',
  asyncHandler(async (req, res) => {
    const orgId = await resolveOrgId(req.auth?.organizationId);
    if (!orgId) throw notFound();
    const article = await db.helpArticle.findFirst({ where: { organizationId: orgId, slug: req.params.slug, status: 'published' } });
    if (!article) throw notFound();
    sendData(res, { article });
  }),
);

helpRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 2) return sendData(res, { total: 0, articles: [], faqs: [], glossary: [] });

    const orgId = await resolveOrgId(req.auth?.organizationId);
    if (!orgId) return sendData(res, { total: 0, articles: [], faqs: [], glossary: [] });

    // Normalised in-memory matching (tolerant of Persian/Arabic variants).
    const [articles, faqs, glossary] = await Promise.all([
      db.helpArticle.findMany({ where: { organizationId: orgId, status: 'published' } }),
      db.helpFaq.findMany({ where: { organizationId: orgId, status: 'published' } }),
      db.helpGlossary.findMany({ where: { organizationId: orgId } }),
    ]);

    const a = articles.filter((x) => faContains(`${x.title} ${x.summary ?? ''} ${x.body}`, q)).map((x) => ({ slug: x.slug, title: x.title, summary: x.summary }));
    const f = faqs.filter((x) => faContains(`${x.question} ${x.answer}`, q)).map((x) => ({ id: x.id, question: x.question, answer: x.answer }));
    const g = glossary.filter((x) => faContains(`${x.term} ${x.definition}`, q)).map((x) => ({ id: x.id, term: x.term, definition: x.definition }));

    sendData(res, { total: a.length + f.length + g.length, articles: a, faqs: f, glossary: g });
  }),
);

// --- Admin: manage help content --------------------------------------------
helpRouter.post(
  '/articles',
  requirePermission('help.manage'),
  validateBody(helpArticleSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as Record<string, unknown>;
    const article = await db.helpArticle.upsert({
      where: { organizationId_slug: { organizationId: orgId, slug: body.slug as string } },
      update: { title: body.title as string, summary: (body.summary as string) ?? null, body: body.body as string, roleScope: body.roleScope as string[], module: (body.module as string) ?? null, sortOrder: body.sortOrder as number, status: body.status as string },
      create: { organizationId: orgId, slug: body.slug as string, title: body.title as string, summary: (body.summary as string) ?? null, body: body.body as string, roleScope: body.roleScope as string[], module: (body.module as string) ?? null, sortOrder: body.sortOrder as number, status: body.status as string },
    });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'help_article.saved', entityType: 'help_article', entityId: article.id }, req);
    sendData(res, { id: article.id }, 201);
  }),
);

helpRouter.delete(
  '/articles/:id',
  requirePermission('help.manage'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    await db.helpArticle.deleteMany({ where: { id: Number(req.params.id), organizationId: orgId } });
    sendData(res, { ok: true });
  }),
);

helpRouter.post(
  '/faqs',
  requirePermission('help.manage'),
  validateBody(helpFaqSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as Record<string, unknown>;
    const faq = await db.helpFaq.create({ data: { organizationId: orgId, question: body.question as string, answer: body.answer as string, category: (body.category as string) ?? null, roleScope: body.roleScope as string[], sortOrder: body.sortOrder as number, status: body.status as string } });
    sendData(res, { id: faq.id }, 201);
  }),
);

helpRouter.delete(
  '/faqs/:id',
  requirePermission('help.manage'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    await db.helpFaq.deleteMany({ where: { id: Number(req.params.id), organizationId: orgId } });
    sendData(res, { ok: true });
  }),
);

helpRouter.post(
  '/glossary',
  requirePermission('help.manage'),
  validateBody(helpGlossarySchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as Record<string, unknown>;
    const g = await db.helpGlossary.create({ data: { organizationId: orgId, term: body.term as string, definition: body.definition as string, category: (body.category as string) ?? null } });
    sendData(res, { id: g.id }, 201);
  }),
);

helpRouter.delete(
  '/glossary/:id',
  requirePermission('help.manage'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    await db.helpGlossary.deleteMany({ where: { id: Number(req.params.id), organizationId: orgId } });
    sendData(res, { ok: true });
  }),
);
