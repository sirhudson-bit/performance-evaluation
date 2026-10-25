/**
 * End-to-end verification against the running API.
 *
 * Drives the real HTTP surface (not the internals) through a complete journey:
 * authentication → RBAC denial → cycle creation → assignment → manager fill &
 * submit → HR approve → publish → result → Excel export → AI gating → CSRF.
 *
 * Usage:  node scripts/verify.cjs   (with the API running and DB seeded)
 */
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4000';
const CRON_SECRET = process.env.CRON_SECRET || 'd9f289972a1bbecac8cdfb797ad9d45821554c12a6a7cb9a';

const results = [];
function check(label, ok, detail = '') {
  results.push({ label, ok: Boolean(ok) });
  console.log(`${ok ? '  ok  ' : '  FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
}

class Client {
  constructor() {
    this.cookies = {};
  }
  cookieHeader() {
    return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  }
  store(res) {
    const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    for (const c of raw) {
      const pair = c.split(';')[0];
      const idx = pair.indexOf('=');
      if (idx > 0) this.cookies[pair.slice(0, idx)] = pair.slice(idx + 1);
    }
  }
  async req(method, path, body) {
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (this.cookieHeader()) headers.cookie = this.cookieHeader();
    if (this.cookies.pe_csrf) headers['x-csrf-token'] = this.cookies.pe_csrf;
    const res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: 'manual' });
    this.store(res);
    return res;
  }
  async json(method, path, body) {
    const res = await this.req(method, path, body);
    const parsed = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data: parsed.data, error: parsed.error };
  }
  async csrf() {
    await this.req('GET', '/api/v1/auth/csrf');
  }
  async login(email, password) {
    await this.csrf();
    return this.json('POST', '/api/v1/auth/login', { email, password });
  }
}

(async () => {
  const admin = new Client();
  const manager = new Client();
  const employee = new Client();
  const hr = new Client();

  // --- Health & anonymous ---------------------------------------------------
  const health = await fetch(`${BASE}/api/v1/health`).then((r) => r.json());
  check('health endpoint reports ok', health?.data?.status === 'ok', health?.data?.status);

  const anonMe = await new Client().json('GET', '/api/v1/auth/me');
  check('anonymous /auth/me is 401', anonMe.status === 401);

  // --- Auth -----------------------------------------------------------------
  const login = await admin.login('admin@performance.test', 'AdminDev!2026');
  check('admin login succeeds', login.ok && login.data?.user?.email === 'admin@performance.test');
  const adminUserId = login.data.user.id;

  // Best-effort: drop AI services left behind by an interrupted run, so the
  // "AI is unconfigured" assertions below always start from a known state.
  const staleProviders = await admin.json('GET', '/api/v1/ai/providers');
  for (const stale of staleProviders.data?.items ?? []) {
    await admin.json('DELETE', `/api/v1/ai/providers/${stale.id}`);
  }
  const me = await admin.json('GET', '/api/v1/auth/me');
  check('admin holds many permissions', (me.data?.permissions?.length ?? 0) > 40, `${me.data?.permissions?.length}`);

  // CSRF: a mutation without the header must be rejected.
  const noCsrf = await fetch(`${BASE}/api/v1/evaluation-cycles`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: admin.cookieHeader() },
    body: JSON.stringify({ name: 'x' }),
  });
  check('mutation without CSRF token is refused (403)', noCsrf.status === 403, `got ${noCsrf.status}`);

  // --- RBAC / data scope ----------------------------------------------------
  const empLogin = await employee.login('employee@performance.test', 'AdminDev!2026');
  check('employee login succeeds', empLogin.ok);
  const empUsers = await employee.json('GET', '/api/v1/users');
  check('employee cannot list users (403)', empUsers.status === 403, `got ${empUsers.status}`);
  const empEmployeeList = await employee.json('GET', '/api/v1/employees');
  check('employee cannot list the employee directory (403)', empEmployeeList.status === 403, `got ${empEmployeeList.status}`);

  const mgrLogin = await manager.login('manager@performance.test', 'AdminDev!2026');
  check('manager login succeeds', mgrLogin.ok);
  const mgrEmployees = await manager.json('GET', '/api/v1/employees');
  check('manager employee-list is scoped (not see-all)', mgrEmployees.ok && mgrEmployees.data?.scope?.seesAll === false);
  await hr.login('hr@performance.test', 'AdminDev!2026');

  // --- Build a cycle from the seeded published form -------------------------
  const forms = await admin.json('GET', '/api/v1/forms');
  const publishedVersion = forms.data?.items?.[0]?.versions?.find((v) => v.status === 'published');
  check('a published form version exists (seeded)', Boolean(publishedVersion), `v${publishedVersion?.version}`);

  const today = new Date();
  const end = new Date(Date.now() + 30 * 86400000);
  const cycle = await admin.json('POST', '/api/v1/evaluation-cycles', {
    name: `دوره بررسی ${Date.now()}`,
    formVersionId: publishedVersion.id,
    startDate: today.toISOString(),
    endDate: end.toISOString(),
    selfAssessment: true,
    appealEnabled: true,
    confidentialityMode: 'named',
    publicationRule: 'manual',
  });
  check('cycle created', cycle.ok && Boolean(cycle.data?.id), cycle.error?.message);
  const cycleId = cycle.data.id;

  const activate = await admin.json('POST', `/api/v1/evaluation-cycles/${cycleId}/status`, { status: 'active' });
  check('cycle activated', activate.ok);

  // Find the employee EMP-004 (employee@) to evaluate.
  const employees = await admin.json('GET', '/api/v1/employees?perPage=50');
  const target = employees.data.items.find((e) => e.employeeNo === 'EMP-004');
  check('target employee found', Boolean(target), target?.employeeNo);

  const assign = await admin.json('POST', `/api/v1/evaluation-cycles/${cycleId}/assignments`, {
    employeeIds: [target.id],
    evaluatorRoles: ['manager', 'self'],
    strategy: 'current_manager',
    weights: { manager: 70, self: 30 },
  });
  check('assignments created', assign.ok && assign.data?.created >= 1, `created ${assign.data?.created}`);

  // --- Manager fills & submits ---------------------------------------------
  const mgrList = await manager.json('GET', '/api/v1/evaluations');
  const mgrAssignment = mgrList.data.items.find((a) => a.cycle.id === cycleId);
  check('manager sees the assignment', Boolean(mgrAssignment));

  const mgrDetail = await manager.json('GET', `/api/v1/evaluations/${mgrAssignment.id}`);
  check('manager can open the assignment', mgrDetail.ok && mgrDetail.data?.sections?.length > 0);

  // Build answers: pick the highest-score option for choice questions; 4 for numeric.
  const answers = [];
  for (const section of mgrDetail.data.sections) {
    for (const q of section.questions) {
      if (q.answerType === 'long_text' || q.answerType === 'short_text') {
        answers.push({ formQuestionId: q.formQuestionId, value: 'توضیح نمونه', isNotApplicable: false });
      } else if (q.answerType === 'numeric_scale' || q.answerType === 'numeric') {
        answers.push({ formQuestionId: q.formQuestionId, value: 4, isNotApplicable: false });
      } else if (q.answerType === 'percentage') {
        answers.push({ formQuestionId: q.formQuestionId, value: 80, isNotApplicable: false });
      } else {
        const best = (q.options || []).slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
        answers.push({ formQuestionId: q.formQuestionId, value: best ? best.value : null, isNotApplicable: false });
      }
    }
  }

  const saveMgr = await manager.json('PUT', `/api/v1/evaluations/${mgrAssignment.id}/responses`, { answers });
  check('manager draft saved', saveMgr.ok, saveMgr.error?.message);
  const submitMgr = await manager.json('POST', `/api/v1/evaluations/${mgrAssignment.id}/submit`);
  check('manager submission accepted', submitMgr.ok, submitMgr.error?.message);

  // --- Self fills & submits -------------------------------------------------
  const empList = await employee.json('GET', '/api/v1/evaluations');
  const selfAssignment = empList.data.items.find((a) => a.cycle.id === cycleId);
  check('employee sees self-assessment assignment', Boolean(selfAssignment) && selfAssignment.evaluatorRole === 'self');
  const empDetail = await employee.json('GET', `/api/v1/evaluations/${selfAssignment.id}`);
  const selfAnswers = [];
  for (const section of empDetail.data.sections) {
    for (const q of section.questions) {
      if (q.answerType === 'long_text' || q.answerType === 'short_text') selfAnswers.push({ formQuestionId: q.formQuestionId, value: 'خودارزیابی', isNotApplicable: false });
      else if (q.answerType === 'numeric_scale' || q.answerType === 'numeric') selfAnswers.push({ formQuestionId: q.formQuestionId, value: 3, isNotApplicable: false });
      else if (q.answerType === 'percentage') selfAnswers.push({ formQuestionId: q.formQuestionId, value: 60, isNotApplicable: false });
      else {
        const opt = (q.options || [])[2] || (q.options || [])[0];
        selfAnswers.push({ formQuestionId: q.formQuestionId, value: opt ? opt.value : null, isNotApplicable: false });
      }
    }
  }
  await employee.json('PUT', `/api/v1/evaluations/${selfAssignment.id}/responses`, { answers: selfAnswers });
  const submitSelf = await employee.json('POST', `/api/v1/evaluations/${selfAssignment.id}/submit`);
  check('self-assessment submission accepted', submitSelf.ok, submitSelf.error?.message);

  // --- HR review (approve) & publish ---------------------------------------
  const approveMgr = await hr.json('POST', `/api/v1/evaluations/${mgrAssignment.id}/review`, { action: 'approve', comment: 'تأیید' });
  check('HR approves the manager assessment', approveMgr.ok, approveMgr.error?.message);

  const publishRes = await hr.json('POST', '/api/v1/evaluations/publish', { cycleId });
  check('HR publishes results', publishRes.ok, publishRes.error?.message);
  check('at least one result published', (publishRes.data?.published?.length ?? 0) >= 1, `published ${publishRes.data?.published?.length}`);

  const resultsList = await hr.json('GET', `/api/v1/evaluations/results/list?cycleId=${cycleId}`);
  const final = resultsList.data.items.find((r) => r.employee?.id === target.id) || resultsList.data.items[0];
  check('final result has a numeric score', final && final.finalScore !== null && Number(final.finalScore) >= 0 && Number(final.finalScore) <= 100, `score ${final?.finalScore}`);

  // --- Excel export round-trip ---------------------------------------------
  const exportReq = await hr.json('POST', '/api/v1/reports/exports', { report: 'employee_results', format: 'xlsx', filters: { cycleId } });
  check('export job created', exportReq.status === 202 && Boolean(exportReq.data?.id));
  const drain = await fetch(`${BASE}/api/v1/jobs/run`, { method: 'POST', headers: { authorization: `Bearer ${CRON_SECRET}` } }).then((r) => r.json());
  check('job drainer processed the export', (drain?.data?.processed ?? 0) >= 1, `processed ${drain?.data?.processed}`);

  const exportId = exportReq.data.id;
  const download = await hr.req('GET', `/api/v1/reports/exports/${exportId}/download`);
  const buf = Buffer.from(await download.arrayBuffer());
  check('export download returns xlsx (zip) content', download.status === 200 && buf[0] === 0x50 && buf[1] === 0x4b, `status ${download.status}`);

  const anonDownload = await fetch(`${BASE}/api/v1/reports/exports/${exportId}/download`, { redirect: 'manual' });
  check('anonymous export download is refused (401)', anonDownload.status === 401, `got ${anonDownload.status}`);

  // --- AI gating ------------------------------------------------------------
  const aiStatus = await admin.json('GET', '/api/v1/ai/status');
  check('AI status endpoint responds', aiStatus.ok);
  const chatDisabled = await employee.json('POST', '/api/v1/ai/chat', { message: 'سلام' });
  check('AI chat is unavailable while unconfigured (503)', chatDisabled.status === 503, `got ${chatDisabled.status}`);

  // Configure the offline provider + enable the chat use-case, then chat.
  const provider = await admin.json('POST', '/api/v1/ai/providers', { name: 'محلی', type: 'offline', enabled: true, isDefault: true });
  await admin.json('POST', '/api/v1/ai/models', { providerId: provider.data.id, modelId: 'offline-rule-based', timeoutMs: 5000, streaming: false, enabled: true });
  await admin.json('PUT', '/api/v1/ai/use-cases', { feature: 'chat', enabled: true, dataCategories: ['help_content'] });
  const chatOn = await employee.json('POST', '/api/v1/ai/chat', { message: 'مراحل ارسال ارزیابی چیست؟' });
  check('AI chat works once enabled (offline provider)', chatOn.ok && typeof chatOn.data?.reply === 'string', chatOn.error?.message);
  check('AI answers carry a "may be wrong" disclosure', (chatOn.data?.note ?? '').includes('نادرست'));

  // Clean up the demo AI provider so re-runs start clean.
  await admin.json('DELETE', `/api/v1/ai/providers/${provider.data.id}`);
  await admin.json('PUT', '/api/v1/ai/use-cases', { feature: 'chat', enabled: false, dataCategories: [] });

  // --- Scoping / 404 --------------------------------------------------------
  const foreign = await admin.json('GET', '/api/v1/employees/99999999');
  check('unknown employee id resolves to 404', foreign.status === 404, `got ${foreign.status}`);

  // --- New features ---------------------------------------------------------
  const pub = await fetch(`${BASE}/api/v1/public/config`).then((r) => r.json());
  check('public PWA config is served', typeof pub?.data?.pwa?.name === 'string');

  const theme = await employee.json('PATCH', '/api/v1/auth/profile', { themePreference: 'dark' });
  check('user can persist a theme preference', theme.ok && theme.data?.user?.themePreference === 'dark');

  const units = await admin.json('GET', '/api/v1/organization/units');
  const accUnit = units.data.items.find((u) => u.code === 'ACC') || units.data.items[0];
  const usersList = await admin.json('GET', '/api/v1/users');
  const empUser = usersList.data.items.find((u) => u.email === 'employee@performance.test');
  const updUser = await admin.json('PATCH', `/api/v1/users/${empUser.id}`, { departmentId: accUnit.id });
  check('admin sets a user department', updUser.ok);
  const usersAfter = await admin.json('GET', '/api/v1/users');
  check('user department is stored and returned', usersAfter.data.items.find((u) => u.id === empUser.id)?.department?.id === accUnit.id);

  const newRole = await admin.json('POST', '/api/v1/roles', { name: 'نقش آزمایشی', key: `test_${Date.now()}`, permissions: ['dashboard.view', 'tickets.view'] });
  check('admin creates a custom role', newRole.status === 201 && Boolean(newRole.data?.id));
  const updRole = await admin.json('PATCH', `/api/v1/roles/${newRole.data.id}`, { name: 'نقش آزمایشی ویرایش‌شده', permissions: ['dashboard.view'] });
  check('admin edits a role and its permissions', updRole.ok);

  const newUnit = await admin.json('POST', '/api/v1/organization/units', { name: 'واحد آزمایشی', code: `T${Date.now() % 100000}`, type: 'department' });
  check('admin creates an org unit', newUnit.status === 201);
  const patchUnit = await admin.json('PATCH', `/api/v1/organization/units/${newUnit.data.id}`, { name: 'واحد آزمایشی ویرایش‌شده' });
  check('admin edits an org unit', patchUnit.ok);
  const newPos = await admin.json('POST', '/api/v1/organization/positions', { title: 'سمت آزمایشی', code: `P${Date.now() % 100000}` });
  check('admin creates a job title', newPos.status === 201);

  const tkt = await employee.json('POST', '/api/v1/tickets', { subject: 'درخواست آزمایشی', category: 'technical', priority: 'normal', body: 'سلام، نیاز به راهنمایی دارم.' });
  check('employee creates a ticket', tkt.status === 201 && Boolean(tkt.data?.id));
  const myTickets = await employee.json('GET', '/api/v1/tickets');
  check('employee sees their own ticket', (myTickets.data?.items ?? []).some((t) => t.id === tkt.data.id));
  const tktReply = await employee.json('POST', `/api/v1/tickets/${tkt.data.id}/messages`, { body: 'پیگیری' });
  check('employee replies to their ticket', tktReply.status === 201);
  const allTickets = await hr.json('GET', '/api/v1/tickets?all=1');
  check('HR lists all tickets (manage scope)', (allTickets.data?.items ?? []).some((t) => t.id === tkt.data.id));
  const staffReply = await hr.json('POST', `/api/v1/tickets/${tkt.data.id}/messages`, { body: 'پاسخ پشتیبانی' });
  check('HR replies as staff', staffReply.status === 201);
  const closeTkt = await hr.json('PATCH', `/api/v1/tickets/${tkt.data.id}`, { status: 'closed' });
  check('HR closes the ticket', closeTkt.ok);
  const empManage = await employee.json('PATCH', `/api/v1/tickets/${tkt.data.id}`, { status: 'open' });
  check('employee cannot manage tickets (403)', empManage.status === 403);

  const analytics = await hr.json('GET', '/api/v1/reports/analytics');
  check('reports analytics returns a distribution', Array.isArray(analytics.data?.distribution) && analytics.data.distribution.length === 5);

  const newForm = await admin.json('POST', '/api/v1/forms', { name: 'فرم آزمایشی' });
  check('admin creates a form', newForm.status === 201);
  const delForm = await admin.json('DELETE', `/api/v1/forms/${newForm.data.id}`);
  check('admin deletes an unused form', delForm.ok && delForm.data?.archived === false);

  const plan = await hr.json('POST', '/api/v1/improvement-plans', { employeeId: target.id, title: 'برنامه آزمایشی', status: 'active', actions: [{ description: 'اقدام نمونه' }] });
  check('HR creates an improvement plan', plan.status === 201);
  const delPlan = await hr.json('DELETE', `/api/v1/improvement-plans/${plan.data.id}`);
  check('HR deletes an improvement plan', delPlan.ok);

  const prop = await manager.json('POST', '/api/v1/compensation/recommendations', { employeeId: target.id, cycleId, mode: 'recommendation', proposedType: 'percent', proposedValue: 10, rationale: 'عملکرد خوب' });
  check('direct manager creates a compensation proposal', prop.status === 201);
  const editProp = await manager.json('PATCH', `/api/v1/compensation/recommendations/${prop.data.id}`, { proposedValue: 12 });
  check('manager edits the proposal before decision', editProp.ok);
  const mgrApprove = await manager.json('POST', `/api/v1/compensation/recommendations/${prop.data.id}/decision`, { decision: 'approved', isOverride: false });
  check('manager cannot approve their own proposal (403)', mgrApprove.status === 403);
  const hrApprove = await hr.json('POST', `/api/v1/compensation/recommendations/${prop.data.id}/decision`, { decision: 'approved', isOverride: false });
  check('HR approves the proposal', hrApprove.ok);

  // --- Admin CRUD, processes, agreements, responses export -------------------
  const delRole = await admin.json('POST', '/api/v1/roles', { name: 'نقش حذفی', key: `del_${Date.now()}`, permissions: ['dashboard.view'] });
  const delRoleRes = await admin.json('DELETE', `/api/v1/roles/${delRole.data.id}`);
  check('admin deletes a role', delRoleRes.ok);

  const delUnit = await admin.json('POST', '/api/v1/organization/units', { name: 'واحد حذفی', code: `DU${Date.now() % 100000}`, type: 'department' });
  const delUnitRes = await admin.json('DELETE', `/api/v1/organization/units/${delUnit.data.id}`);
  check('admin deletes an org unit', delUnitRes.ok);
  const delPos = await admin.json('POST', '/api/v1/organization/positions', { title: 'سمت حذفی', code: `DP${Date.now() % 100000}` });
  const delPosRes = await admin.json('DELETE', `/api/v1/organization/positions/${delPos.data.id}`);
  check('admin deletes a position', delPosRes.ok);

  const resetPw = await admin.json('POST', `/api/v1/users/${empUser.id}/reset-password`);
  check('admin issues a password reset link (never the password)', resetPw.ok && typeof resetPw.data.link === 'string' && resetPw.data.link.includes('token='));
  const delSelf = await admin.json('DELETE', `/api/v1/users/${adminUserId}`);
  check('an admin cannot delete their own account (400)', delSelf.status === 400, `got ${delSelf.status}`);

  const proc = await admin.json('POST', '/api/v1/processes', { name: `فرایند ${Date.now()}`, evaluationModel: 'weighted_360', targetGroups: [], status: 'draft' });
  check('admin creates a performance process', proc.status === 201 && Boolean(proc.data.id));
  const step = await admin.json('POST', `/api/v1/processes/${proc.data.id}/steps`, { name: 'خودارزیابی', order: 0, ownerType: 'role', ownerRoleKey: 'employee', slaDays: 7 });
  check('steps can be added to a process', step.status === 201);
  const dim = await admin.json('POST', `/api/v1/processes/${proc.data.id}/dimensions`, { name: 'کیفیت', weight: 60, sortOrder: 0, ownerRoleKey: 'manager' });
  check('dimensions can be added to a process', dim.status === 201);

  const agreement = await hr.json('POST', '/api/v1/agreements', { employeeId: target.id, title: 'توافق آزمایشی', status: 'active', indicators: [{ name: 'رضایت مشتری', targetValue: 90, weight: 1, progress: 0, sortOrder: 0 }] });
  check('an agreement with indicators is created', agreement.status === 201 && Boolean(agreement.data.id));
  const agreementDetail = await hr.json('GET', `/api/v1/agreements/${agreement.data.id}`);
  const indicatorId = agreementDetail.data.agreement.indicators[0]?.id;
  const progressRes = await hr.json('PATCH', `/api/v1/agreements/indicators/${indicatorId}`, { actualValue: 80, progress: 65 });
  check('indicator progress is recorded', progressRes.ok);
  const entryRes = await hr.json('POST', `/api/v1/agreements/${agreement.data.id}/entries`, { type: 'feedback', body: 'بازخورد نمونه' });
  check('an agreement log entry is recorded', entryRes.status === 201);

  const respBlocked = await hr.json('POST', '/api/v1/reports/exports', { report: 'responses_by_user', format: 'xlsx', filters: { cycleId } });
  check('HR cannot export raw responses (403)', respBlocked.status === 403, `got ${respBlocked.status}`);
  const respExport = await admin.json('POST', '/api/v1/reports/exports', { report: 'responses_by_user', format: 'xlsx', filters: { cycleId } });
  check('platform admin can request the responses export', respExport.status === 202);
  await fetch(`${BASE}/api/v1/jobs/run`, { method: 'POST', headers: { authorization: `Bearer ${CRON_SECRET}` } });
  const respDownload = await admin.req('GET', `/api/v1/reports/exports/${respExport.data.id}/download`);
  const respBuf = Buffer.from(await respDownload.arrayBuffer());
  check('responses export downloads as xlsx', respDownload.status === 200 && respBuf[0] === 0x50 && respBuf[1] === 0x4b);

  const analytics2 = await admin.json('GET', '/api/v1/reports/analytics');
  check('analytics includes per-unit breakdown', Array.isArray(analytics2.data?.byUnit));

  // --- AI provider management (default / edit / delete) ---------------------
  const provA = await admin.json('POST', '/api/v1/ai/providers', { name: 'محلی آزمایشی', type: 'offline', enabled: true, isDefault: false, isFallback: false });
  check('admin creates an AI provider', provA.status === 201 && Boolean(provA.data.id));
  const provB = await admin.json('POST', '/api/v1/ai/providers', { name: 'سرویس دوم', type: 'offline', enabled: true, isDefault: true, isFallback: false });
  check('a second provider can be created as default', provB.status === 201);

  const makeDefault = await admin.json('PATCH', `/api/v1/ai/providers/${provA.data.id}`, { isDefault: true });
  check('a provider can be set as default', makeDefault.ok);
  const listProviders = await admin.json('GET', '/api/v1/ai/providers');
  const defaults = (listProviders.data.items || []).filter((p) => p.isDefault);
  check('exactly one provider is the default', defaults.length === 1 && defaults[0].id === provA.data.id, `defaults=${defaults.length}`);

  const editProv = await admin.json('PATCH', `/api/v1/ai/providers/${provA.data.id}`, { name: 'محلی آزمایشی (ویرایش‌شده)', enabled: false });
  check('a provider can be edited', editProv.ok);
  const probeProv = await admin.json('POST', `/api/v1/ai/providers/${provA.data.id}/probe`);
  check('provider probe answers without throwing', probeProv.ok || probeProv.status === 503, `got ${probeProv.status}`);
  const delProv = await admin.json('DELETE', `/api/v1/ai/providers/${provB.data.id}`);
  check('a provider can be deleted', delProv.ok);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((error) => {
  console.error('verify crashed:', error);
  process.exit(1);
});
