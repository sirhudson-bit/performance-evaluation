/**
 * Database seed.
 *
 * Idempotent: safe to re-run. Creates the permission catalog, the default
 * roles, the bootstrap administrator, and (when SEED_DEMO_DATA is not "false")
 * a demo organization with a small hierarchy, a sample question bank, a
 * published evaluation form, help content and the asset/license inventory.
 *
 * No production credentials are baked in: the admin password comes from
 * SEED_ADMIN_PASSWORD, or a random one is generated and printed once.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { PERMISSION_DEFS, ROLE_DEFS, DEFAULT_SCORING_POLICY } from '@pe/shared';

const db = new PrismaClient();

function randomPassword(): string {
  return crypto.randomBytes(12).toString('base64url');
}

async function seedPermissions(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const def of PERMISSION_DEFS) {
    const row = await db.permission.upsert({
      where: { name: def.name },
      update: { category: def.category, description: def.descriptionFa },
      create: { name: def.name, category: def.category, description: def.descriptionFa },
    });
    map.set(row.name, row.id);
  }
  return map;
}

async function seedRoles(organizationId: number, permissionIds: Map<string, number>): Promise<Map<string, number>> {
  const roles = new Map<string, number>();

  for (const def of ROLE_DEFS) {
    const role = await db.role.upsert({
      where: { organizationId_key: { organizationId, key: def.key } },
      update: { name: def.nameFa, description: def.descriptionFa, isProtected: def.protected },
      create: {
        organizationId,
        key: def.key,
        name: def.nameFa,
        description: def.descriptionFa,
        isProtected: def.protected,
      },
    });
    roles.set(def.key, role.id);

    // Rebuild the role's permission set to match the definition exactly.
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    const names = def.permissions ?? PERMISSION_DEFS.map((p) => p.name);
    const rows = names
      .map((name) => permissionIds.get(name))
      .filter((id): id is number => typeof id === 'number')
      .map((permissionId) => ({ roleId: role.id, permissionId }));
    if (rows.length > 0) {
      await db.rolePermission.createMany({ data: rows, skipDuplicates: true });
    }
  }

  return roles;
}

async function upsertUser(params: {
  organizationId: number | null;
  email: string;
  name: string;
  password: string;
  roleKeys: string[];
  roles: Map<string, number>;
  isPlatformAdmin?: boolean;
}) {
  const passwordHash = bcrypt.hashSync(params.password, 12);
  const user = await db.user.upsert({
    where: { organizationId_email: { organizationId: params.organizationId, email: params.email } },
    update: { name: params.name, status: 'active' },
    create: {
      organizationId: params.organizationId,
      email: params.email,
      name: params.name,
      passwordHash,
      status: 'active',
      isPlatformAdmin: params.isPlatformAdmin ?? false,
    },
  });

  for (const key of params.roleKeys) {
    const roleId = params.roles.get(key);
    if (!roleId) continue;
    await db.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId } },
      update: {},
      create: { userId: user.id, roleId },
    });
  }

  return user;
}

async function main() {
  const permissionIds = await seedPermissions();

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || randomPassword();
  const generatedAdminPassword = !process.env.SEED_ADMIN_PASSWORD;

  // --- Organization --------------------------------------------------------
  const org = await db.organization.upsert({
    where: { slug: 'demo-org' },
    update: {},
    create: {
      name: 'سازمان نمونه',
      slug: 'demo-org',
      status: 'active',
      timezone: 'Asia/Tehran',
      currency: 'IRT',
    },
  });

  const roles = await seedRoles(org.id, permissionIds);

  const admin = await upsertUser({
    organizationId: org.id,
    email: adminEmail,
    name: 'مدیر سامانه',
    password: adminPassword,
    roleKeys: ['platform_super_admin', 'system_admin'],
    roles,
    isPlatformAdmin: true,
  });

  // --- Default settings & compliance profile -------------------------------
  const settings: Record<string, string> = {
    platform_name: 'سامانه ارزیابی عملکرد',
    organization_display_name: 'سازمان نمونه',
    default_currency: 'IRT',
    default_theme: 'light',
    chart_palette: JSON.stringify(['#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#0ea5e9', '#38bdf8', '#64748b', '#94a3b8']),
    help_tours_enabled: 'true',
    floating_tips_enabled: 'true',
    ai_chat_enabled_for: JSON.stringify(['system_admin', 'hr_manager', 'department_manager', 'employee']),
    // PWA
    pwa_enabled: 'true',
    pwa_name: 'سامانه ارزیابی عملکرد',
    pwa_short_name: 'ارزیابی',
    pwa_description: 'سامانه ارزیابی عملکرد کارکنان سازمان',
    pwa_theme_color: '#1e3a8a',
    pwa_background_color: '#f8fafc',
    pwa_display: 'standalone',
    pwa_orientation: 'portrait',
    pwa_install_prompt: 'true',
    pwa_offline: 'true',
  };
  for (const [key, value] of Object.entries(settings)) {
    await db.setting.upsert({
      where: { organizationId_key: { organizationId: org.id, key } },
      update: { value },
      create: { organizationId: org.id, key, value },
    });
  }

  await db.complianceProfile.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      // Deliberately NOT invented — the business owner must fill these in.
      legalName: null,
      country: null,
      contactEmail: null,
      contactPhone: null,
      jurisdictions: [],
      targetMarkets: [],
      hasPaidOffering: false,
      policyVersion: '1.0',
    },
  });

  // --- Asset / license inventory -------------------------------------------
  const assets = [
    { name: 'Vazirmatn', kind: 'font', source: '@fontsource-variable/vazirmatn', license: 'SIL OFL 1.1', attribution: 'Vazirmatn by Saber Rastikerdar', commercialUse: true, usage: 'Persian UI typography', verified: true },
    { name: 'Lucide', kind: 'icon', source: 'lucide-react', license: 'ISC', attribution: 'Lucide contributors', commercialUse: true, usage: 'UI icons', verified: true },
    { name: 'Next.js', kind: 'library', source: 'next', license: 'MIT', attribution: 'Vercel', commercialUse: true, usage: 'Web framework', verified: true },
    { name: 'Prisma', kind: 'library', source: 'prisma', license: 'Apache-2.0', attribution: 'Prisma', commercialUse: true, usage: 'ORM', verified: true },
  ];
  for (const asset of assets) {
    const existing = await db.asset.findFirst({ where: { organizationId: org.id, name: asset.name } });
    if (existing) await db.asset.update({ where: { id: existing.id }, data: asset });
    else await db.asset.create({ data: { organizationId: org.id, ...asset } });
  }

  // --- Scoring policy, workflow --------------------------------------------
  const scoringPolicy = await db.scoringPolicyVersion.upsert({
    where: { organizationId_name_version: { organizationId: org.id, name: 'سیاست پیش‌فرض', version: 1 } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'سیاست پیش‌فرض',
      version: 1,
      model: DEFAULT_SCORING_POLICY.model,
      status: 'active',
      config: {
        rounding: DEFAULT_SCORING_POLICY.rounding,
        requireComplete: DEFAULT_SCORING_POLICY.requireComplete,
        allowWeightNormalization: DEFAULT_SCORING_POLICY.allowWeightNormalization,
        weightTarget: DEFAULT_SCORING_POLICY.weightTarget,
        unansweredPolicy: DEFAULT_SCORING_POLICY.unansweredPolicy,
      },
    },
  });

  const workflow = await db.workflow.upsert({
    where: { organizationId_name_version: { organizationId: org.id, name: 'گردش‌کار پیش‌فرض', version: 1 } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'گردش‌کار پیش‌فرض',
      version: 1,
      status: 'active',
      config: {
        selfAssessment: true,
        stages: ['self', 'manager', 'hr_review', 'publish'],
        requiredEvaluators: ['manager'],
      },
    },
  });

  // --- Question bank -------------------------------------------------------
  const categories = [
    { name: 'پرسش‌های عمومی', sortOrder: 1 },
    { name: 'پرسش‌های تخصصی شغلی', sortOrder: 2 },
    { name: 'پرسش‌های مدیریتی', sortOrder: 3 },
    { name: 'پرسش‌های ارزیابی', sortOrder: 4 },
  ];
  const categoryIds = new Map<string, number>();
  for (const cat of categories) {
    const existing = await db.questionCategory.findFirst({ where: { organizationId: org.id, name: cat.name } });
    const row = existing
      ? await db.questionCategory.update({ where: { id: existing.id }, data: { sortOrder: cat.sortOrder } })
      : await db.questionCategory.create({ data: { organizationId: org.id, name: cat.name, sortOrder: cat.sortOrder } });
    categoryIds.set(cat.name, row.id);
  }

  type QDef = {
    stableKey: string;
    category: string;
    title: string;
    text: string;
    answerType: string;
    weight: number;
    subjectType: string;
    respondentRoles: string[];
    options?: { label: string; value: string; score?: number; na?: boolean }[];
    scoring?: Prisma.InputJsonValue;
  };

  const rating5 = (_prefix: string) => [
    { label: 'بسیار ضعیف', value: '1', score: 20 },
    { label: 'ضعیف', value: '2', score: 40 },
    { label: 'متوسط', value: '3', score: 60 },
    { label: 'خوب', value: '4', score: 80 },
    { label: 'عالی', value: '5', score: 100 },
  ];

  const questions: QDef[] = [
    { stableKey: 'quality', category: 'پرسش‌های عمومی', title: 'کیفیت کار', text: 'کیفیت خروجی کار را چگونه ارزیابی می‌کنید؟', answerType: 'rating_5', weight: 2, subjectType: 'employee', respondentRoles: ['self', 'manager'], options: rating5('quality') },
    { stableKey: 'teamwork', category: 'پرسش‌های عمومی', title: 'کار تیمی', text: 'میزان همکاری و کار تیمی چگونه است؟', answerType: 'rating_5', weight: 1.5, subjectType: 'employee', respondentRoles: ['self', 'manager'], options: rating5('teamwork') },
    { stableKey: 'deadlines', category: 'پرسش‌های عمومی', title: 'رعایت مهلت‌ها', text: 'پایبندی به مهلت‌های تعیین‌شده را چگونه ارزیابی می‌کنید؟', answerType: 'rating_5', weight: 1.5, subjectType: 'employee', respondentRoles: ['self', 'manager'], options: rating5('deadlines') },
    { stableKey: 'technical_skill', category: 'پرسش‌های تخصصی شغلی', title: 'مهارت فنی و تخصصی', text: 'سطح مهارت فنی مرتبط با شغل را از ۱ تا ۱۰ نمره دهید.', answerType: 'numeric_scale', weight: 2, subjectType: 'employee', respondentRoles: ['self', 'manager'], scoring: { min: 1, max: 10 } },
    { stableKey: 'initiative', category: 'پرسش‌های تخصصی شغلی', title: 'ابتکار و نوآوری', text: 'میزان ارائه ایده و ابتکار در کار چگونه است؟', answerType: 'rating_5', weight: 1, subjectType: 'employee', respondentRoles: ['self', 'manager'], options: rating5('initiative') },
    { stableKey: 'leadership', category: 'پرسش‌های مدیریتی', title: 'رهبری تیم', text: 'توانایی هدایت و رهبری تیم را چگونه ارزیابی می‌کنید؟', answerType: 'rating_5', weight: 2, subjectType: 'manager', respondentRoles: ['manager', 'report', 'peer'], options: rating5('leadership') },
    { stableKey: 'feedback', category: 'پرسش‌های مدیریتی', title: 'بازخورد مؤثر', text: 'میزان ارائه بازخورد سازنده به کارکنان چگونه است؟', answerType: 'rating_5', weight: 1, subjectType: 'manager', respondentRoles: ['report', 'peer'], options: rating5('feedback') },
    { stableKey: 'strengths', category: 'پرسش‌های ارزیابی', title: 'نقاط قوت', text: 'مهم‌ترین نقاط قوت را شرح دهید.', answerType: 'long_text', weight: 0, subjectType: 'employee', respondentRoles: ['manager'] },
    { stableKey: 'improvements', category: 'پرسش‌های ارزیابی', title: 'زمینه‌های بهبود', text: 'زمینه‌های قابل بهبود را شرح دهید.', answerType: 'long_text', weight: 0, subjectType: 'employee', respondentRoles: ['manager'] },
  ];

  const questionIds = new Map<string, number>();
  const questionVersionIds = new Map<string, number>();

  for (const [index, q] of questions.entries()) {
    const question = await db.question.upsert({
      where: { organizationId_stableKey: { organizationId: org.id, stableKey: q.stableKey } },
      update: {
        categoryId: categoryIds.get(q.category) ?? null,
        title: q.title,
        text: q.text,
        answerType: q.answerType,
        weight: new Prisma.Decimal(q.weight),
        subjectType: q.subjectType,
        respondentRoles: q.respondentRoles,
        scoring: (q.scoring ?? {}) as Prisma.InputJsonValue,
        status: 'active',
        sortOrder: index,
      },
      create: {
        organizationId: org.id,
        stableKey: q.stableKey,
        categoryId: categoryIds.get(q.category) ?? null,
        title: q.title,
        text: q.text,
        answerType: q.answerType,
        weight: new Prisma.Decimal(q.weight),
        subjectType: q.subjectType,
        respondentRoles: q.respondentRoles,
        scoring: (q.scoring ?? {}) as Prisma.InputJsonValue,
        status: 'active',
        sortOrder: index,
      },
    });
    questionIds.set(q.stableKey, question.id);

    // Options
    if (q.options) {
      await db.questionOption.deleteMany({ where: { questionId: question.id } });
      for (const [i, opt] of q.options.entries()) {
        await db.questionOption.create({
          data: {
            questionId: question.id,
            label: opt.label,
            value: opt.value,
            score: opt.score !== undefined ? new Prisma.Decimal(opt.score) : null,
            sortOrder: i,
          },
        });
      }
    }

    // Frozen version 1 snapshot
    const options = await db.questionOption.findMany({ where: { questionId: question.id }, orderBy: { sortOrder: 'asc' } });
    const snapshot = {
      id: question.id,
      stableKey: q.stableKey,
      title: q.title,
      text: q.text,
      answerType: q.answerType,
      weight: q.weight,
      subjectType: q.subjectType,
      respondentRoles: q.respondentRoles,
      scoring: q.scoring ?? {},
      options: options.map((o) => ({
        label: o.label,
        value: o.value,
        score: o.score ? Number(o.score) : null,
        isNotApplicable: o.isNotApplicable,
      })),
    };
    const existingVersion = await db.questionVersion.findUnique({
      where: { questionId_version: { questionId: question.id, version: 1 } },
    });
    if (existingVersion) {
      await db.questionVersion.update({ where: { id: existingVersion.id }, data: { snapshot } });
      questionVersionIds.set(q.stableKey, existingVersion.id);
    } else {
      const v = await db.questionVersion.create({
        data: { questionId: question.id, version: 1, snapshot, createdBy: admin.id },
      });
      questionVersionIds.set(q.stableKey, v.id);
    }
  }

  // --- Evaluation form + published version ---------------------------------
  const form = await db.evaluationForm.upsert({
    where: { id: (await db.evaluationForm.findFirst({ where: { organizationId: org.id, name: 'فرم ارزیابی عملکرد' } }))?.id ?? -1 },
    update: {},
    create: { organizationId: org.id, name: 'فرم ارزیابی عملکرد', description: 'فرم پیش‌فرض ارزیابی عملکرد کارکنان', status: 'published' },
  });

  let formVersion = await db.formVersion.findUnique({ where: { formId_version: { formId: form.id, version: 1 } } });
  if (!formVersion) {
    formVersion = await db.formVersion.create({
      data: {
        formId: form.id,
        version: 1,
        status: 'published',
        scoringPolicyId: scoringPolicy.id,
        confidentialityMode: 'named',
        selfAssessment: true,
        anonymityThreshold: 3,
        publishedAt: new Date(),
        createdBy: admin.id,
      },
    });

    const sectionGeneral = await db.formSection.create({
      data: { formVersionId: formVersion.id, title: 'شایستگی‌های عمومی', weight: new Prisma.Decimal(60), sortOrder: 1 },
    });
    const sectionJob = await db.formSection.create({
      data: { formVersionId: formVersion.id, title: 'شایستگی‌های شغلی', weight: new Prisma.Decimal(40), sortOrder: 2 },
    });

    const layout: { key: string; sectionId: number; weight: number }[] = [
      { key: 'quality', sectionId: sectionGeneral.id, weight: 2 },
      { key: 'teamwork', sectionId: sectionGeneral.id, weight: 1.5 },
      { key: 'deadlines', sectionId: sectionGeneral.id, weight: 1.5 },
      { key: 'technical_skill', sectionId: sectionJob.id, weight: 2 },
      { key: 'initiative', sectionId: sectionJob.id, weight: 1 },
      { key: 'strengths', sectionId: sectionGeneral.id, weight: 0 },
      { key: 'improvements', sectionId: sectionGeneral.id, weight: 0 },
    ];
    for (const [i, item] of layout.entries()) {
      const qvId = questionVersionIds.get(item.key);
      if (!qvId) continue;
      await db.formQuestion.create({
        data: {
          formVersionId: formVersion.id,
          sectionId: item.sectionId,
          questionVersionId: qvId,
          weight: new Prisma.Decimal(item.weight),
          required: item.weight > 0,
          sortOrder: i,
        },
      });
    }

    await db.evaluationForm.update({ where: { id: form.id }, data: { currentVersion: 1 } });
  }

  // --- Demo hierarchy ------------------------------------------------------
  let demoCreated = false;
  if (process.env.SEED_DEMO_DATA !== 'false') {
    const rootUnit = await upsertUnit(org.id, null, 'مدیریت عامل', 'HQ', 'division', 0);
    const itUnit = await upsertUnit(org.id, rootUnit.id, 'معاونت فناوری اطلاعات', 'IT', 'department', 1);
    const devUnit = await upsertUnit(org.id, itUnit.id, 'واحد توسعه نرم‌افزار', 'DEV', 'subdepartment', 2);
    const hrUnit = await upsertUnit(org.id, rootUnit.id, 'منابع انسانی', 'HR', 'department', 3);
    const accUnit = await upsertUnit(org.id, rootUnit.id, 'حسابداری', 'ACC', 'department', 4);
    const whUnit = await upsertUnit(org.id, rootUnit.id, 'انبار', 'WH', 'department', 5);
    const mktUnit = await upsertUnit(org.id, rootUnit.id, 'بازاریابی', 'MKT', 'department', 6);

    const ceoPos = await upsertPosition(org.id, rootUnit.id, 'مدیرعامل', 'CEO');
    const cioPos = await upsertPosition(org.id, itUnit.id, 'مدیر فناوری اطلاعات', 'CIO');
    const leadPos = await upsertPosition(org.id, devUnit.id, 'سرپرست تیم توسعه', 'LEAD');
    const devPos = await upsertPosition(org.id, devUnit.id, 'برنامه‌نویس', 'DEV');
    const hrPos = await upsertPosition(org.id, hrUnit.id, 'کارشناس منابع انسانی', 'HR-OFF');

    const demoPassword = adminPassword;

    const ceoUser = await upsertUser({ organizationId: org.id, email: 'ceo@performance.test', name: 'مدیرعامل', password: demoPassword, roleKeys: ['department_manager'], roles });
    const cioUser = await upsertUser({ organizationId: org.id, email: 'cio@performance.test', name: 'مدیر فناوری اطلاعات', password: demoPassword, roleKeys: ['department_manager'], roles });
    const leadUser = await upsertUser({ organizationId: org.id, email: 'manager@performance.test', name: 'سرپرست توسعه', password: demoPassword, roleKeys: ['department_manager'], roles });
    const emp1User = await upsertUser({ organizationId: org.id, email: 'employee@performance.test', name: 'برنامه‌نویس یک', password: demoPassword, roleKeys: ['employee'], roles });
    const emp2User = await upsertUser({ organizationId: org.id, email: 'employee2@performance.test', name: 'برنامه‌نویس دو', password: demoPassword, roleKeys: ['employee'], roles });
    const hrUser = await upsertUser({ organizationId: org.id, email: 'hr@performance.test', name: 'کارشناس منابع انسانی', password: demoPassword, roleKeys: ['hr_manager'], roles });

    // Assign each user a department (work unit) so the field is populated.
    const departments: [number, number][] = [
      [admin.id, hrUnit.id],
      [ceoUser.id, rootUnit.id],
      [cioUser.id, itUnit.id],
      [leadUser.id, devUnit.id],
      [emp1User.id, devUnit.id],
      [emp2User.id, devUnit.id],
      [hrUser.id, hrUnit.id],
    ];
    for (const [userId, departmentId] of departments) {
      await db.user.update({ where: { id: userId }, data: { departmentId } });
    }
    void accUnit;
    void whUnit;
    void mktUnit;

    const ceo = await upsertEmployee(org.id, ceoUser.id, 'EMP-001', 'مدیر', 'عامل', rootUnit.id, ceoPos.id, null);
    const cio = await upsertEmployee(org.id, cioUser.id, 'EMP-002', 'مدیر', 'فناوری اطلاعات', itUnit.id, cioPos.id, ceo.id);
    const lead = await upsertEmployee(org.id, leadUser.id, 'EMP-003', 'سرپرست', 'توسعه', devUnit.id, leadPos.id, cio.id);
    const emp1 = await upsertEmployee(org.id, emp1User.id, 'EMP-004', 'برنامه‌نویس', 'یک', devUnit.id, devPos.id, lead.id);
    const emp2 = await upsertEmployee(org.id, emp2User.id, 'EMP-005', 'برنامه‌نویس', 'دو', devUnit.id, devPos.id, lead.id);
    await upsertEmployee(org.id, hrUser.id, 'EMP-006', 'کارشناس', 'منابع انسانی', hrUnit.id, hrPos.id, ceo.id);

    // Manager history (as-of resolution for a cycle).
    const now = new Date();
    for (const [employee, manager] of [[cio, ceo], [lead, cio], [emp1, lead], [emp2, lead]] as const) {
      const existingHistory = await db.employeeManagerHistory.findFirst({ where: { employeeId: employee.id, effectiveTo: null } });
      if (!existingHistory) {
        await db.employeeManagerHistory.create({
          data: {
            organizationId: org.id,
            employeeId: employee.id,
            managerEmployeeId: manager.id,
            unitId: employee.unitId,
            positionId: employee.positionId,
            effectiveFrom: now,
          },
        });
      }
    }

    demoCreated = true;
    void workflow;
  }

  // --- Help content --------------------------------------------------------
  const articles = [
    { slug: 'getting-started', title: 'شروع کار با سامانه', summary: 'آشنایی اولیه با نقش‌ها، منو و مسیرهای اصلی', module: 'general', body: '# شروع کار\n\nپس از ورود، داشبورد متناسب با نقش شما نمایش داده می‌شود. از منوی کنار، بخش‌های «کارهای من» و (در صورت داشتن دسترسی) «مدیریت» را می‌بینید. برای راهنمای گام‌به‌گام هر بخش، تورهای آموزشی را از صفحه «راهنما» باز کنید.' },
    { slug: 'profile-and-theme', title: 'پروفایل، پوسته و حالت شب', summary: 'ویرایش اطلاعات شخصی، تغییر رمز و تغییر روشن/تیره', module: 'profile', body: '# پروفایل و پوسته\n\nدر «پروفایل من» می‌توانید نام نمایشی و شماره تلفن خود را ویرایش کنید و رمز عبور را تغییر دهید. با دکمه خورشید/ماه در نوار بالا بین حالت روشن و تیره جابه‌جا شوید؛ انتخاب شما ذخیره می‌شود. دپارتمان و نقش‌ها توسط مدیر تعیین می‌شوند و از این صفحه قابل تغییر نیستند.' },
    { slug: 'evaluations', title: 'تکمیل و ارسال ارزیابی', summary: 'گام‌به‌گام پر کردن فرم ارزیابی', module: 'evaluations', body: '# تکمیل ارزیابی\n\n۱) از «ارزیابی‌های من» یک مورد را باز کنید. ۲) به همه پرسش‌های الزامی پاسخ دهید؛ برای پرسش‌های بی‌ربط گزینه «مصداق ندارد» را بزنید. ۳) «ذخیره پیش‌نویس» را بزنید تا کارتان حفظ شود. ۴) با «ارسال نهایی ارزیابی» ثبت می‌شود. پس از ارسال، ویرایش تنها با بازگشایی مجاز منابع انسانی ممکن است.' },
    { slug: 'questions', title: 'بانک پرسش‌ها', summary: 'ساخت و ویرایش پرسش‌ها و دسته‌ها', module: 'questions', roleScope: ['system_admin', 'hr_manager'], body: '# بانک پرسش‌ها\n\nدر «بانک پرسش‌ها» پرسش بسازید: شناسه پایدار، عنوان، متن، نوع پاسخ (طیف، تک/چندگزینه‌ای، درصد، عدد، متن، بله/خیر)، وزن و دسته. برای پرسش‌های گزینه‌ای، امتیاز هر گزینه را تعیین کنید. هر ویرایش، یک نسخه جدید می‌سازد تا نتیجه‌های قبلی تغییر نکنند.' },
    { slug: 'forms', title: 'فرم‌ها و نسخه‌ها', summary: 'ساخت، ویرایش، انتشار و حذف فرم', module: 'forms', roleScope: ['system_admin', 'hr_manager'], body: '# فرم‌ها\n\nفرم بسازید، سپس پرسش‌ها را در بخش‌ها بچینید و وزن بخش‌ها را مشخص کنید. با «انتشار» نسخه تثبیت می‌شود. برای تغییر، نسخه جدید بسازید. حذف فرمِ استفاده‌نشده ممکن است؛ فرمی که در دوره‌ای استفاده شده فقط بایگانی می‌شود تا تاریخچه حفظ شود.' },
    { slug: 'cycles', title: 'دوره‌های ارزیابی و ارجاع ارزیابان', summary: 'ایجاد دوره، بازه، خودارزیابی و ارجاع', module: 'cycles', roleScope: ['system_admin', 'hr_manager'], body: '# دوره‌ها\n\nیک دوره با نام، نسخه فرم منتشرشده، تاریخ شروع/پایان، خودارزیابی و اعتراض بسازید، سپس آن را «فعال» کنید. در بخش ارجاع، کارکنان و نقش ارزیابان (خود، مدیر مستقیم، منابع انسانی) را انتخاب کنید؛ مدیر مستقیم بر پایه تاریخچه سازمانی همان بازه تعیین می‌شود.' },
    { slug: 'review-publish', title: 'بررسی، تأیید و انتشار نتایج', summary: 'گردش‌کار بررسی منابع انسانی و انتشار', module: 'reviews', roleScope: ['system_admin', 'hr_manager'], body: '# بررسی و انتشار\n\nپس از ارسال ارزیابی‌ها، منابع انسانی هر ارزیابی را بررسی و تأیید یا برای اصلاح بازمی‌گرداند. با «انتشار نتایج»، امتیاز نهایی محاسبه و برای افراد مجاز قابل مشاهده می‌شود. انتشار تنها زمانی انجام می‌شود که همه مراحل الزامی تکمیل شده باشد.' },
    { slug: 'results-appeals', title: 'نتایج و اعتراض‌ها', summary: 'مشاهده نتیجه نهایی و ثبت اعتراض', module: 'results', body: '# نتایج و اعتراض\n\nنتیجه نهایی و تفکیک بخش‌ها در «نتایج» نمایش داده می‌شود. اگر برای دوره امکان اعتراض فعال باشد، می‌توانید دلیل خود را ثبت کنید؛ مسئول رسیدگی تصمیم و در صورت پذیرش، امتیاز اصلاح‌شده را ثبت می‌کند. نتیجه اصلی هرگز حذف نمی‌شود.' },
    { slug: 'improvement-plans', title: 'برنامه‌های بهبود', summary: 'ساخت و ویرایش برنامه بهبود عملکرد', module: 'improvement_plans', roleScope: ['system_admin', 'hr_manager', 'department_manager'], body: '# برنامه‌های بهبود\n\nمدیران و منابع انسانی می‌توانند برای کارکنان برنامه بهبود بسازند یا ویرایش کنند: عنوان، اقدام‌ها، مهلت و وضعیت. برنامه‌ها به کارمند و در صورت نیاز به یک دوره متصل می‌شوند.' },
    { slug: 'compensation', title: 'پیشنهاد پاداش و افزایش حقوق', summary: 'پیشنهاد مدیر و تأیید مدیر سامانه/منابع انسانی', module: 'compensation', roleScope: ['system_admin', 'hr_manager', 'department_manager'], body: '# جبران خدمات\n\nمدیر مستقیم می‌تواند بر پایه ارزیابی، پیشنهاد پاداش/افزایش/ارتقا ثبت کند (حالت پیشنهاد یا محاسبه بر پایه سیاست). پیشنهاد تا پیش از تصمیم قابل ویرایش است. مدیر سامانه یا منابع انسانی آن را تأیید یا رد می‌کند و در صورت تغییر، دلیل ثبت می‌شود. هیچ پرداخت یا تغییر حقوقی خودکار انجام نمی‌شود.' },
    { slug: 'reports', title: 'گزارش‌ها و نمودارها', summary: 'خروجی اکسل، نمودارها و فیلترها', module: 'reports', roleScope: ['system_admin', 'hr_manager', 'department_manager'], body: '# گزارش‌ها\n\nدر «گزارش‌ها» می‌توانید خروجی اکسل (چند شیت) یا CSV بگیرید و نمودارهای توزیع امتیاز و وضعیت تکمیل را ببینید. خروجی‌ها در پس‌زمینه ساخته می‌شوند و فقط ردیف‌هایی را شامل می‌شوند که مجاز به دیدنشان هستید.' },
    { slug: 'excel-import', title: 'ورود اطلاعات از اکسل', summary: 'قالب، پیش‌نمایش، تشخیص تکراری و ثبت', module: 'imports', roleScope: ['system_admin', 'hr_manager'], body: '# ورود از اکسل\n\nقالب را دانلود کنید، فایل را بارگذاری کنید و پیش از ثبت، ردیف‌های معتبر و نامعتبر و موارد تکراری را بررسی کنید. ورود فقط پس از تأیید نهایی انجام می‌شود.' },
    { slug: 'ai', title: 'دستیار هوشمند', summary: 'پرسش از دستیار و محدودیت‌های آن', module: 'ai', body: '# دستیار هوشمند\n\nاز «دستیار هوشمند» می‌توانید درباره قواعد و فرایند سامانه بپرسید. پاسخ‌ها با هوش مصنوعی تولید می‌شوند و ممکن است نادرست باشند. دستیار درباره امتیاز، ارتقا یا حقوق تصمیم نمی‌گیرد و به‌طور پیش‌فرض هیچ داده ارزیابی شخصی ارسال نمی‌شود.' },
    { slug: 'tickets', title: 'پیام‌ها و تیکت‌های پشتیبانی', summary: 'ارتباط با پشتیبانی و پیگیری درخواست', module: 'tickets', body: '# پیام‌ها و تیکت‌ها\n\nدر بخش «پیام‌ها و تیکت‌ها» یک درخواست با موضوع، دسته و اولویت ثبت کنید و در همان صفحه گفت‌وگو را ادامه دهید. مسئولان پشتیبانی پاسخ می‌دهند و وضعیت تیکت را به‌روز می‌کنند.' },
    { slug: 'users-roles', title: 'کاربران، نقش‌ها و دسترسی‌ها', summary: 'ایجاد کاربر، دپارتمان و ساخت نقش سفارشی', module: 'users', roleScope: ['system_admin', 'hr_manager'], body: '# کاربران و نقش‌ها\n\nدر «کاربران» حساب بسازید، دپارتمان/واحد کاری، نقش‌ها و وضعیت را تعیین کنید. در «نقش‌ها» می‌توانید نقش سفارشی بسازید و دسترسی‌ها را از کاتالوگ انتخاب کنید. نقش محافظت‌شده قابل ویرایش یا واگذاری نیست.' },
    { slug: 'organization', title: 'ساختار سازمانی و سمت‌ها', summary: 'واحدها و عنوان‌های شغلی', module: 'organization', roleScope: ['system_admin'], body: '# ساختار سازمانی\n\nدر «ساختار سازمانی» واحدها (مثل حسابداری، انبار، بازاریابی) و عنوان‌های شغلی را بسازید و ویرایش کنید. این ساختار مبنای تعیین دپارتمان کاربران و محدوده دسترسی مدیران است.' },
    { slug: 'settings-pwa', title: 'تنظیمات و نسخه نصب‌شو (PWA)', summary: 'برندینگ، پوسته پیش‌فرض و نصب اپلیکیشن', module: 'settings', roleScope: ['system_admin'], body: '# تنظیمات و PWA\n\nدر «تنظیمات»، نام سامانه، پوسته پیش‌فرض و مشخصات اپلیکیشن نصب‌شو (نام، نام کوتاه، رنگ‌ها، حالت نمایش، اعلان نصب و پشتیبانی آفلاین) را تنظیم کنید. سپس کاربران می‌توانند سامانه را از مرورگر روی دستگاه خود نصب کنند.' },
    { slug: 'compliance', title: 'انطباق و حریم خصوصی', summary: 'اطلاعات هویتی کسب‌وکار و سرویس‌های ثالث', module: 'compliance', roleScope: ['system_admin', 'hr_manager'], body: '# انطباق\n\nدر «انطباق و حریم خصوصی» اطلاعات هویتی سازمان و فهرست سرویس‌های ثالث را ثبت کنید. موارد تأییدنشده با برچسب «نیازمند تأیید کسب‌وکار» در اسناد نمایش داده می‌شوند و جایگزین نمی‌شوند.' },
    { slug: 'tours', title: 'تورهای آموزشی', summary: 'راهنمای تعاملی گام‌به‌گام هر بخش', module: 'help', body: '# تورها\n\nهر بخش یک تور تعاملی کوتاه دارد که عناصر واقعی همان صفحه را نشان می‌دهد: ورود، پروفایل، ارزیابی، پرسش‌ها، فرم‌ها، دوره‌ها، بررسی/انتشار، گزارش‌ها، هوش مصنوعی، کاربران/نقش‌ها، تیکت‌ها، تنظیمات و انطباق. می‌توانید تور را رد، تکرار یا ببندید؛ قابل استفاده با صفحه‌کلید است.' },
  ];
  for (const article of articles) {
    await db.helpArticle.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug: article.slug } },
      update: { title: article.title, summary: article.summary, body: article.body, module: article.module },
      create: { organizationId: org.id, slug: article.slug, title: article.title, summary: article.summary, body: article.body, module: article.module, roleScope: article.roleScope ?? [] },
    });
  }

  const faqs = [
    { question: 'چگونه رمز عبور خود را تغییر دهم؟', answer: 'از بخش پروفایل و سپس «امنیت حساب» می‌توانید رمز عبور را تغییر دهید.', category: 'عمومی' },
    { question: 'آیا می‌توانم ارزیابی ارسال‌شده را ویرایش کنم؟', answer: 'خیر، پس از ارسال نهایی فقط با بازگشایی مجاز توسط منابع انسانی قابل تغییر است.', category: 'ارزیابی' },
    { question: 'خروجی اکسل چه اطلاعاتی دارد؟', answer: 'بسته به سطح دسترسی شما می‌تواند شامل نتایج، تفکیک بخش‌ها و وضعیت تکمیل باشد.', category: 'گزارش‌ها' },
  ];
  for (const faq of faqs) {
    const existing = await db.helpFaq.findFirst({ where: { organizationId: org.id, question: faq.question } });
    if (!existing) await db.helpFaq.create({ data: { organizationId: org.id, ...faq } });
  }

  const glossary = [
    { term: 'وزن', definition: 'ضریب اهمیت یک پرسش، بخش یا ارزیاب در محاسبه امتیاز.' },
    { term: 'نسخه فرم', definition: 'عکسِ ثابت و تغییرناپذیر یک فرم در زمان انتشار.' },
    { term: 'خودارزیابی', definition: 'ارزیابی که خود کارمند از عملکردش انجام می‌دهد.' },
    { term: 'سیاست امتیازدهی', definition: 'قواعد محاسبه امتیاز، وزن‌ها و گردکردن.' },
  ];
  for (const g of glossary) {
    const existing = await db.helpGlossary.findFirst({ where: { organizationId: org.id, term: g.term } });
    if (!existing) await db.helpGlossary.create({ data: { organizationId: org.id, ...g } });
  }

  console.log('\n✔ Seed complete.');
  console.log(`  Organization: ${org.name} (id ${org.id})`);
  console.log(`  Admin login : ${adminEmail}`);
  if (generatedAdminPassword) {
    console.log(`  Admin password (generated once, SAVE IT): ${adminPassword}`);
  }
  if (demoCreated) {
    console.log('  Demo users  : ceo@ / cio@ / manager@ / employee@ / employee2@ / hr@ (performance.test)');
    console.log(`  Demo password: ${adminPassword}`);
  }
  console.log('');
}

async function upsertUnit(organizationId: number, parentId: number | null, name: string, code: string, type: string, sortOrder: number) {
  const existing = await db.organizationUnit.findFirst({ where: { organizationId, code } });
  if (existing) return existing;
  return db.organizationUnit.create({ data: { organizationId, parentId, name, code, type, sortOrder } });
}

async function upsertPosition(organizationId: number, unitId: number, title: string, code: string) {
  const existing = await db.position.findFirst({ where: { organizationId, code } });
  if (existing) return existing;
  return db.position.create({ data: { organizationId, unitId, title, code } });
}

async function upsertEmployee(
  organizationId: number,
  userId: number,
  employeeNo: string,
  firstName: string,
  lastName: string,
  unitId: number,
  positionId: number,
  managerId: number | null,
) {
  const existing = await db.employee.findUnique({ where: { organizationId_employeeNo: { organizationId, employeeNo } } });
  if (existing) return existing;
  return db.employee.create({
    data: { organizationId, userId, employeeNo, firstName, lastName, unitId, positionId, managerId, status: 'active' },
  });
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
