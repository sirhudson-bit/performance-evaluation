-- AlterTable
ALTER TABLE "evaluation_cycles" ADD COLUMN     "process_id" INTEGER;

-- AlterTable
ALTER TABLE "form_questions" ADD COLUMN     "computed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "formula" JSONB;

-- CreateTable
CREATE TABLE "performance_processes" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "evaluation_model" TEXT NOT NULL DEFAULT 'weighted_360',
    "target_groups" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_steps" (
    "id" SERIAL NOT NULL,
    "process_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "owner_type" TEXT NOT NULL DEFAULT 'role',
    "owner_role_key" TEXT,
    "owner_user_id" INTEGER,
    "owner_unit_id" INTEGER,
    "sla_days" INTEGER,

    CONSTRAINT "process_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_dimensions" (
    "id" SERIAL NOT NULL,
    "process_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "weight" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "owner_role_key" TEXT,
    "owner_user_id" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "process_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_steps" (
    "id" SERIAL NOT NULL,
    "cycle_id" INTEGER NOT NULL,
    "process_step_id" INTEGER,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "owner_role_key" TEXT,
    "owner_user_id" INTEGER,
    "due_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "cycle_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_agreements" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "cycle_id" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_indicators" (
    "id" SERIAL NOT NULL,
    "agreement_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "target_value" DECIMAL(15,2),
    "actual_value" DECIMAL(15,2),
    "weight" DECIMAL(7,3) NOT NULL DEFAULT 1,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "agreement_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_entries" (
    "id" SERIAL NOT NULL,
    "agreement_id" INTEGER NOT NULL,
    "author_user_id" INTEGER,
    "type" TEXT NOT NULL DEFAULT 'feedback',
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agreement_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "performance_processes_organization_id_status_idx" ON "performance_processes"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "performance_processes_organization_id_name_version_key" ON "performance_processes"("organization_id", "name", "version");

-- CreateIndex
CREATE INDEX "process_steps_process_id_idx" ON "process_steps"("process_id");

-- CreateIndex
CREATE INDEX "process_dimensions_process_id_idx" ON "process_dimensions"("process_id");

-- CreateIndex
CREATE INDEX "cycle_steps_cycle_id_idx" ON "cycle_steps"("cycle_id");

-- CreateIndex
CREATE INDEX "performance_agreements_organization_id_employee_id_idx" ON "performance_agreements"("organization_id", "employee_id");

-- CreateIndex
CREATE INDEX "agreement_indicators_agreement_id_idx" ON "agreement_indicators"("agreement_id");

-- CreateIndex
CREATE INDEX "agreement_entries_agreement_id_idx" ON "agreement_entries"("agreement_id");

-- AddForeignKey
ALTER TABLE "evaluation_cycles" ADD CONSTRAINT "evaluation_cycles_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "performance_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_processes" ADD CONSTRAINT "performance_processes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_steps" ADD CONSTRAINT "process_steps_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "performance_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_dimensions" ADD CONSTRAINT "process_dimensions_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "performance_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_steps" ADD CONSTRAINT "cycle_steps_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "evaluation_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_agreements" ADD CONSTRAINT "performance_agreements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_agreements" ADD CONSTRAINT "performance_agreements_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_indicators" ADD CONSTRAINT "agreement_indicators_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "performance_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_entries" ADD CONSTRAINT "agreement_entries_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "performance_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
