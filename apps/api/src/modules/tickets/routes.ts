import { Router } from 'express';
import { ticketCreateSchema, ticketReplySchema, ticketStatusSchema } from '@pe/validation';
import { db } from '../../db.js';
import { asyncHandler, notFound, sendData } from '../../lib/http.js';
import { recordAudit } from '../../lib/audit.js';
import { requirePermission, getAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/scope.js';
import { validateBody } from '../../middleware/validate.js';

export const ticketsRouter = Router();

const STATUS_FOR_STAFF_REPLY = 'answered';

/** A user sees their own tickets; a handler sees the whole organization. */
function seesAll(permissions: string[]): boolean {
  return permissions.includes('tickets.manage');
}

ticketsRouter.get(
  '/',
  requirePermission('tickets.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const all = req.query.all === '1' && seesAll(auth.permissions);

    const items = await db.supportTicket.findMany({
      where: { organizationId: orgId, ...(all ? {} : { userId: auth.id }) },
      include: {
        user: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
    sendData(res, { items, scope: all ? 'all' : 'own' });
  }),
);

ticketsRouter.post(
  '/',
  requirePermission('tickets.view'),
  validateBody(ticketCreateSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const body = req.body as { subject: string; category: string; priority: string; body: string };

    const ticket = await db.supportTicket.create({
      data: {
        organizationId: orgId,
        userId: auth.id,
        subject: body.subject,
        category: body.category,
        priority: body.priority,
        status: 'open',
        messages: { create: { authorUserId: auth.id, fromStaff: false, body: body.body } },
      },
    });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'ticket.created', entityType: 'support_ticket', entityId: ticket.id }, req);
    sendData(res, { id: ticket.id }, 201);
  }),
);

ticketsRouter.get(
  '/:id',
  requirePermission('tickets.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const ticket = await db.supportTicket.findFirst({
      where: { id: Number(req.params.id), organizationId: orgId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true } },
        messages: { include: { author: { select: { id: true, name: true } } }, orderBy: { id: 'asc' } },
      },
    });
    if (!ticket) throw notFound();
    if (ticket.userId !== auth.id && !seesAll(auth.permissions)) throw notFound();
    sendData(res, { ticket });
  }),
);

ticketsRouter.post(
  '/:id/messages',
  requirePermission('tickets.view'),
  validateBody(ticketReplySchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const ticket = await db.supportTicket.findFirst({ where: { id, organizationId: orgId } });
    if (!ticket) throw notFound();

    const staff = seesAll(auth.permissions);
    if (ticket.userId !== auth.id && !staff) throw notFound();
    const { body } = req.body as { body: string };

    await db.$transaction([
      db.ticketMessage.create({ data: { ticketId: id, authorUserId: auth.id, fromStaff: staff, body } }),
      db.supportTicket.update({
        where: { id },
        data: {
          lastMessageAt: new Date(),
          status: staff ? STATUS_FOR_STAFF_REPLY : 'open',
          ...(staff && !ticket.assignedToId ? { assignedToId: auth.id } : {}),
        },
      }),
    ]);
    sendData(res, { ok: true }, 201);
  }),
);

ticketsRouter.patch(
  '/:id',
  requirePermission('tickets.manage'),
  validateBody(ticketStatusSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const orgId = requireOrganization(auth);
    const id = Number(req.params.id);
    const ticket = await db.supportTicket.findFirst({ where: { id, organizationId: orgId } });
    if (!ticket) throw notFound();
    const body = req.body as { status: string; assignedToId?: number | null };

    await db.supportTicket.update({
      where: { id },
      data: { status: body.status, ...(body.assignedToId !== undefined ? { assignedToId: body.assignedToId || auth.id } : {}) },
    });
    await recordAudit({ organizationId: orgId, actorUserId: auth.id, action: 'ticket.updated', entityType: 'support_ticket', entityId: id, after: { status: body.status } }, req);
    sendData(res, { ok: true });
  }),
);
