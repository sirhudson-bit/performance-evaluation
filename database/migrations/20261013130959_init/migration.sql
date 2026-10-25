-- CreateTable
CREATE TABLE "organizations" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tehran',
    "locale" TEXT NOT NULL DEFAULT 'fa-IR',
    "calendar" TEXT NOT NULL DEFAULT 'jalali',
    "currency" TEXT NOT NULL DEFAULT 'IRT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_units" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" TEXT NOT NULL DEFAULT 'department',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "unit_id" INTEGER,
    "title" TEXT NOT NULL,
    "code" TEXT,
    "level" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "employee_no" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "display_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "unit_id" INTEGER,
    "position_id" INTEGER,
    "manager_id" INTEGER,
    "hire_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_manager_history" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "manager_employee_id" INTEGER,
    "unit_id" INTEGER,
    "position_id" INTEGER,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_manager_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "is_platform_admin" BOOLEAN NOT NULL DEFAULT false,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret" TEXT,
    "preferred_language" TEXT NOT NULL DEFAULT 'fa',
    "tours_state" JSONB,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "last_activity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_protected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_categories" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "stable_key" TEXT NOT NULL,
    "category_id" INTEGER,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "guidance" TEXT,
    "subject_type" TEXT NOT NULL DEFAULT 'employee',
    "respondent_roles" JSONB NOT NULL DEFAULT '[]',
    "answer_type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "weight" DECIMAL(7,3) NOT NULL DEFAULT 1,
    "scoring" JSONB NOT NULL DEFAULT '{}',
    "condition" JSONB,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_versions" (
    "id" SERIAL NOT NULL,
    "question_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" SERIAL NOT NULL,
    "question_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "score" DECIMAL(7,3),
    "is_not_applicable" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_policy_versions" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'normalized_weighted_average',
    "config" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scoring_policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "config" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_forms" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "current_version" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_versions" (
    "id" SERIAL NOT NULL,
    "form_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scoring_policy_id" INTEGER,
    "confidentiality_mode" TEXT NOT NULL DEFAULT 'named',
    "self_assessment" BOOLEAN NOT NULL DEFAULT false,
    "anonymity_threshold" INTEGER NOT NULL DEFAULT 3,
    "notes" TEXT,
    "published_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_sections" (
    "id" SERIAL NOT NULL,
    "form_version_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "weight" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "form_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_questions" (
    "id" SERIAL NOT NULL,
    "form_version_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,
    "question_version_id" INTEGER NOT NULL,
    "weight" DECIMAL(7,3) NOT NULL DEFAULT 1,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "condition" JSONB,

    CONSTRAINT "form_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_periods" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'custom',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_cycles" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "period_id" INTEGER,
    "name" TEXT NOT NULL,
    "form_version_id" INTEGER NOT NULL,
    "workflow_id" INTEGER,
    "scoring_policy_id" INTEGER,
    "compensation_policy_id" INTEGER,
    "confidentiality_mode" TEXT NOT NULL DEFAULT 'named',
    "self_assessment" BOOLEAN NOT NULL DEFAULT false,
    "appeal_enabled" BOOLEAN NOT NULL DEFAULT false,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "submission_deadline" TIMESTAMP(3),
    "publication_rule" TEXT NOT NULL DEFAULT 'auto_on_approve',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_assignments" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "cycle_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "evaluator_role" TEXT NOT NULL,
    "evaluator_user_id" INTEGER,
    "evaluator_employee_id" INTEGER,
    "weight" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "due_date" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "form_version_id" INTEGER NOT NULL,
    "version_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_responses" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "assignment_id" INTEGER NOT NULL,
    "form_question_id" INTEGER NOT NULL,
    "question_version_id" INTEGER NOT NULL,
    "answer_type" TEXT NOT NULL,
    "value" JSONB NOT NULL DEFAULT '{}',
    "score" DECIMAL(7,4),
    "is_not_applicable" BOOLEAN NOT NULL DEFAULT false,
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_scores" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "assignment_id" INTEGER NOT NULL,
    "section_id" INTEGER,
    "section_score" DECIMAL(7,4),
    "form_score" DECIMAL(7,4),
    "detail" JSONB NOT NULL DEFAULT '{}',
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "final_evaluation_results" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "cycle_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "final_score" DECIMAL(7,4),
    "scoring_policy_version_id" INTEGER,
    "breakdown" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "published_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "final_evaluation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_reviews" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "assignment_id" INTEGER NOT NULL,
    "reviewer_id" INTEGER,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "from_status" TEXT NOT NULL,
    "to_status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeal_requests" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "cycle_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "reviewer_id" INTEGER,
    "decision" TEXT,
    "decided_at" TIMESTAMP(3),
    "score_before" DECIMAL(7,4),
    "score_after" DECIMAL(7,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appeal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "improvement_plans" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "cycle_id" INTEGER,
    "title" TEXT NOT NULL,
    "actions" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "owner_user_id" INTEGER,
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "improvement_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensation_policies" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "mode" TEXT NOT NULL DEFAULT 'recommendation',
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "config" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensation_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensation_recommendations" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "cycle_id" INTEGER,
    "employee_id" INTEGER NOT NULL,
    "compensation_policy_id" INTEGER,
    "mode" TEXT NOT NULL DEFAULT 'recommendation',
    "input_score" DECIMAL(7,4),
    "proposed_type" TEXT,
    "proposed_value" DECIMAL(15,2),
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "rationale" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compensation_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensation_approvals" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "recommendation_id" INTEGER NOT NULL,
    "approver_id" INTEGER,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "is_override" BOOLEAN NOT NULL DEFAULT false,
    "override_reason" TEXT,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensation_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_providers" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "base_url" TEXT,
    "encrypted_api_key" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_fallback" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_model_configurations" (
    "id" SERIAL NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "model_id" TEXT NOT NULL,
    "label" TEXT,
    "max_tokens" INTEGER,
    "temperature" DECIMAL(3,2),
    "timeout_ms" INTEGER NOT NULL DEFAULT 30000,
    "streaming" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_model_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_use_case_policies" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "feature" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "data_categories" JSONB NOT NULL DEFAULT '[]',
    "min_role_key" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_use_case_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_events" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "provider_id" INTEGER,
    "model_id" TEXT,
    "feature" TEXT NOT NULL,
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "latency_ms" INTEGER,
    "status" TEXT NOT NULL,
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'گفت‌وگوی جدید',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER,
    "actor_user_id" INTEGER,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_profiles" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "legal_name" TEXT,
    "registration_no" TEXT,
    "national_id" TEXT,
    "address" TEXT,
    "country" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "jurisdictions" JSONB NOT NULL DEFAULT '[]',
    "targetMarkets" JSONB NOT NULL DEFAULT '[]',
    "service_offerings" TEXT,
    "has_paid_offering" BOOLEAN NOT NULL DEFAULT false,
    "data_retention" TEXT,
    "international_transfers" TEXT,
    "policy_version" TEXT NOT NULL DEFAULT '1.0',
    "reviewed_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "third_party_services" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT,
    "purpose" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "data_transmitted" TEXT,
    "requires_consent" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "privacy_url" TEXT,
    "notes" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "third_party_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_preferences" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "categories" JSONB NOT NULL DEFAULT '{}',
    "policy_version" TEXT NOT NULL DEFAULT '1.0',
    "ip_address" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "file_name" TEXT,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "errors" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_jobs" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "report" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'xlsx',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "file_path" TEXT,
    "rows" INTEGER,
    "size" INTEGER,
    "expires_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER,
    "queue" TEXT NOT NULL DEFAULT 'default',
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "dedupe_key" TEXT,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_articles" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "role_scope" JSONB NOT NULL DEFAULT '[]',
    "module" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'published',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_faqs" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT,
    "role_scope" JSONB NOT NULL DEFAULT '[]',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'published',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_glossary" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "category" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_glossary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_help_progress" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "tour_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_help_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT,
    "license" TEXT,
    "attribution" TEXT,
    "commercial_use" BOOLEAN NOT NULL DEFAULT true,
    "usage" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organization_units_organization_id_parent_id_idx" ON "organization_units"("organization_id", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_units_organization_id_code_key" ON "organization_units"("organization_id", "code");

-- CreateIndex
CREATE INDEX "positions_organization_id_unit_id_idx" ON "positions"("organization_id", "unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "positions_organization_id_code_key" ON "positions"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_unit_id_idx" ON "employees"("organization_id", "unit_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_manager_id_idx" ON "employees"("organization_id", "manager_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organization_id_employee_no_key" ON "employees"("organization_id", "employee_no");

-- CreateIndex
CREATE INDEX "employee_manager_history_organization_id_employee_id_effect_idx" ON "employee_manager_history"("organization_id", "employee_id", "effective_from");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_organization_id_email_key" ON "users"("organization_id", "email");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organization_id_key_key" ON "roles"("organization_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "question_categories_organization_id_idx" ON "question_categories"("organization_id");

-- CreateIndex
CREATE INDEX "questions_organization_id_category_id_idx" ON "questions"("organization_id", "category_id");

-- CreateIndex
CREATE INDEX "questions_organization_id_status_idx" ON "questions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "questions_organization_id_stable_key_key" ON "questions"("organization_id", "stable_key");

-- CreateIndex
CREATE UNIQUE INDEX "question_versions_question_id_version_key" ON "question_versions"("question_id", "version");

-- CreateIndex
CREATE INDEX "question_options_question_id_idx" ON "question_options"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_policy_versions_organization_id_name_version_key" ON "scoring_policy_versions"("organization_id", "name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "workflows_organization_id_name_version_key" ON "workflows"("organization_id", "name", "version");

-- CreateIndex
CREATE INDEX "evaluation_forms_organization_id_idx" ON "evaluation_forms"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "form_versions_form_id_version_key" ON "form_versions"("form_id", "version");

-- CreateIndex
CREATE INDEX "form_sections_form_version_id_idx" ON "form_sections"("form_version_id");

-- CreateIndex
CREATE INDEX "form_questions_form_version_id_idx" ON "form_questions"("form_version_id");

-- CreateIndex
CREATE INDEX "form_questions_section_id_idx" ON "form_questions"("section_id");

-- CreateIndex
CREATE INDEX "evaluation_periods_organization_id_idx" ON "evaluation_periods"("organization_id");

-- CreateIndex
CREATE INDEX "evaluation_cycles_organization_id_status_idx" ON "evaluation_cycles"("organization_id", "status");

-- CreateIndex
CREATE INDEX "evaluation_assignments_organization_id_evaluator_user_id_st_idx" ON "evaluation_assignments"("organization_id", "evaluator_user_id", "status");

-- CreateIndex
CREATE INDEX "evaluation_assignments_cycle_id_status_idx" ON "evaluation_assignments"("cycle_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_assignments_cycle_id_employee_id_evaluator_role__key" ON "evaluation_assignments"("cycle_id", "employee_id", "evaluator_role", "evaluator_user_id");

-- CreateIndex
CREATE INDEX "evaluation_responses_assignment_id_idx" ON "evaluation_responses"("assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_responses_assignment_id_form_question_id_key" ON "evaluation_responses"("assignment_id", "form_question_id");

-- CreateIndex
CREATE INDEX "evaluation_scores_assignment_id_idx" ON "evaluation_scores"("assignment_id");

-- CreateIndex
CREATE INDEX "final_evaluation_results_organization_id_status_idx" ON "final_evaluation_results"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "final_evaluation_results_cycle_id_employee_id_key" ON "final_evaluation_results"("cycle_id", "employee_id");

-- CreateIndex
CREATE INDEX "evaluation_reviews_assignment_id_idx" ON "evaluation_reviews"("assignment_id");

-- CreateIndex
CREATE INDEX "appeal_requests_organization_id_status_idx" ON "appeal_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "improvement_plans_organization_id_employee_id_idx" ON "improvement_plans"("organization_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "compensation_policies_organization_id_name_version_key" ON "compensation_policies"("organization_id", "name", "version");

-- CreateIndex
CREATE INDEX "compensation_recommendations_organization_id_status_idx" ON "compensation_recommendations"("organization_id", "status");

-- CreateIndex
CREATE INDEX "compensation_approvals_recommendation_id_idx" ON "compensation_approvals"("recommendation_id");

-- CreateIndex
CREATE INDEX "ai_providers_organization_id_idx" ON "ai_providers"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_model_configurations_provider_id_model_id_key" ON "ai_model_configurations"("provider_id", "model_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_use_case_policies_organization_id_feature_key" ON "ai_use_case_policies"("organization_id", "feature");

-- CreateIndex
CREATE INDEX "ai_usage_events_organization_id_created_at_idx" ON "ai_usage_events"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_conversations_organization_id_user_id_idx" ON "ai_conversations"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "ai_messages_conversation_id_idx" ON "ai_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "settings_organization_id_key_key" ON "settings"("organization_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_profiles_organization_id_key" ON "compliance_profiles"("organization_id");

-- CreateIndex
CREATE INDEX "third_party_services_organization_id_idx" ON "third_party_services"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "consent_preferences_organization_id_user_id_key" ON "consent_preferences"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "import_jobs_organization_id_idx" ON "import_jobs"("organization_id");

-- CreateIndex
CREATE INDEX "export_jobs_organization_id_status_idx" ON "export_jobs"("organization_id", "status");

-- CreateIndex
CREATE INDEX "jobs_status_run_at_idx" ON "jobs"("status", "run_at");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_dedupe_key_key" ON "jobs"("dedupe_key");

-- CreateIndex
CREATE UNIQUE INDEX "help_articles_organization_id_slug_key" ON "help_articles"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "help_faqs_organization_id_idx" ON "help_faqs"("organization_id");

-- CreateIndex
CREATE INDEX "help_glossary_organization_id_idx" ON "help_glossary"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_help_progress_user_id_tour_key_key" ON "user_help_progress"("user_id", "tour_key");

-- CreateIndex
CREATE INDEX "assets_organization_id_idx" ON "assets"("organization_id");

-- AddForeignKey
ALTER TABLE "organization_units" ADD CONSTRAINT "organization_units_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_units" ADD CONSTRAINT "organization_units_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "organization_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organization_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organization_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_manager_history" ADD CONSTRAINT "employee_manager_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_manager_history" ADD CONSTRAINT "employee_manager_history_manager_employee_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_categories" ADD CONSTRAINT "question_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "question_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_versions" ADD CONSTRAINT "question_versions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_policy_versions" ADD CONSTRAINT "scoring_policy_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_forms" ADD CONSTRAINT "evaluation_forms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "evaluation_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_scoring_policy_id_fkey" FOREIGN KEY ("scoring_policy_id") REFERENCES "scoring_policy_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_sections" ADD CONSTRAINT "form_sections_form_version_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "form_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_questions" ADD CONSTRAINT "form_questions_form_version_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "form_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_questions" ADD CONSTRAINT "form_questions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "form_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_questions" ADD CONSTRAINT "form_questions_question_version_id_fkey" FOREIGN KEY ("question_version_id") REFERENCES "question_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_periods" ADD CONSTRAINT "evaluation_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_cycles" ADD CONSTRAINT "evaluation_cycles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_cycles" ADD CONSTRAINT "evaluation_cycles_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "evaluation_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_cycles" ADD CONSTRAINT "evaluation_cycles_form_version_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "form_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_cycles" ADD CONSTRAINT "evaluation_cycles_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_cycles" ADD CONSTRAINT "evaluation_cycles_scoring_policy_id_fkey" FOREIGN KEY ("scoring_policy_id") REFERENCES "scoring_policy_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_cycles" ADD CONSTRAINT "evaluation_cycles_compensation_policy_id_fkey" FOREIGN KEY ("compensation_policy_id") REFERENCES "compensation_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_assignments" ADD CONSTRAINT "evaluation_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_assignments" ADD CONSTRAINT "evaluation_assignments_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "evaluation_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_assignments" ADD CONSTRAINT "evaluation_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_assignments" ADD CONSTRAINT "evaluation_assignments_form_version_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "form_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_responses" ADD CONSTRAINT "evaluation_responses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_responses" ADD CONSTRAINT "evaluation_responses_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "evaluation_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_scores" ADD CONSTRAINT "evaluation_scores_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_scores" ADD CONSTRAINT "evaluation_scores_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "evaluation_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_evaluation_results" ADD CONSTRAINT "final_evaluation_results_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_evaluation_results" ADD CONSTRAINT "final_evaluation_results_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "evaluation_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_evaluation_results" ADD CONSTRAINT "final_evaluation_results_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_evaluation_results" ADD CONSTRAINT "final_evaluation_results_scoring_policy_version_id_fkey" FOREIGN KEY ("scoring_policy_version_id") REFERENCES "scoring_policy_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_reviews" ADD CONSTRAINT "evaluation_reviews_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_reviews" ADD CONSTRAINT "evaluation_reviews_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "evaluation_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeal_requests" ADD CONSTRAINT "appeal_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeal_requests" ADD CONSTRAINT "appeal_requests_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "evaluation_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeal_requests" ADD CONSTRAINT "appeal_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "improvement_plans" ADD CONSTRAINT "improvement_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "improvement_plans" ADD CONSTRAINT "improvement_plans_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_policies" ADD CONSTRAINT "compensation_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_recommendations" ADD CONSTRAINT "compensation_recommendations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_recommendations" ADD CONSTRAINT "compensation_recommendations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_recommendations" ADD CONSTRAINT "compensation_recommendations_compensation_policy_id_fkey" FOREIGN KEY ("compensation_policy_id") REFERENCES "compensation_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_approvals" ADD CONSTRAINT "compensation_approvals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_approvals" ADD CONSTRAINT "compensation_approvals_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "compensation_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_providers" ADD CONSTRAINT "ai_providers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_model_configurations" ADD CONSTRAINT "ai_model_configurations_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_use_case_policies" ADD CONSTRAINT "ai_use_case_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_profiles" ADD CONSTRAINT "compliance_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "third_party_services" ADD CONSTRAINT "third_party_services_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_preferences" ADD CONSTRAINT "consent_preferences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_preferences" ADD CONSTRAINT "consent_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_articles" ADD CONSTRAINT "help_articles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_faqs" ADD CONSTRAINT "help_faqs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_glossary" ADD CONSTRAINT "help_glossary_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_help_progress" ADD CONSTRAINT "user_help_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
