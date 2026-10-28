<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('grade_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('classroom_subject_id')->constrained()->cascadeOnDelete();
            $table->foreignId('term_id')->constrained()->cascadeOnDelete();
            $table->string('source_type'); // exam|assignment|in_person_exam|manual
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('delivery')->default('in_person'); // in_person|online
            $table->string('status')->default('draft'); // draft|approved|published
            $table->unsignedSmallInteger('score');
            $table->unsignedSmallInteger('max_score')->default(100);
            $table->foreignId('recorded_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('published_at')->nullable();
            $table->timestampsTz();
            $table->index(['school_id', 'student_id', 'term_id']);
            $table->index(['classroom_subject_id', 'status']);
        });

        DB::statement("alter table grade_items add constraint grade_items_status_check check (status in ('draft', 'approved', 'published'))");
        DB::statement("alter table grade_items add constraint grade_items_source_check check (source_type in ('exam', 'assignment', 'in_person_exam', 'manual'))");
        DB::statement("alter table grade_items add constraint grade_items_delivery_check check (delivery in ('in_person', 'online'))");
        DB::statement('alter table grade_items add constraint grade_items_score_check check (score <= max_score)');

        // Any change to a PUBLISHED grade lives here — append-only, reason mandatory.
        Schema::create('grade_changes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('grade_item_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('old_score');
            $table->unsignedSmallInteger('new_score');
            $table->text('reason');
            $table->foreignId('changed_by')->constrained('users')->cascadeOnDelete();
            $table->timestampTz('changed_at')->useCurrent();
            $table->index(['grade_item_id', 'changed_at']);
        });

        DB::statement("create or replace function app_forbid_mutation_grade() returns trigger as \$\$
            begin raise exception '% is append-only', TG_TABLE_NAME; end
        \$\$ language plpgsql");
        DB::statement('create trigger grade_changes_append_only before update or delete on grade_changes for each row execute function app_forbid_mutation_grade()');

        Schema::create('report_cards', function (Blueprint $table): void {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('term_id')->constrained()->cascadeOnDelete();
            $table->string('kind'); // in_person|online — two separate report cards
            $table->unsignedSmallInteger('version')->default(1);
            $table->string('status')->default('draft'); // draft|approved|published|superseded
            $table->string('template_key')->nullable();
            $table->foreignId('published_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('published_at')->nullable();
            $table->timestampsTz();
            $table->unique(['student_id', 'term_id', 'kind', 'version']);
            $table->index(['school_id', 'term_id', 'status']);
        });

        DB::statement("alter table report_cards add constraint report_cards_kind_check check (kind in ('in_person', 'online'))");
        DB::statement("alter table report_cards add constraint report_cards_status_check check (status in ('draft', 'approved', 'published', 'superseded'))");

        // Frozen copy of the scores at publish time.
        Schema::create('report_card_lines', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('report_card_id')->constrained()->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('score');
            $table->text('teacher_comment')->nullable();
            // Phase-2 hook: descriptive (elementary) template payload.
            $table->jsonb('data')->nullable();
            $table->timestampsTz();
            $table->unique(['report_card_id', 'subject_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_card_lines');
        Schema::dropIfExists('report_cards');
        Schema::dropIfExists('grade_changes');
        DB::statement('drop function if exists app_forbid_mutation_grade()');
        Schema::dropIfExists('grade_items');
    }
};
