<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('consent_requests', function (Blueprint $table): void {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('body')->nullable();
            // From school_settings; stored per request for history.
            $table->string('policy'); // one_parent|both_parents
            $table->timestampTz('due_at')->nullable();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestampsTz();
            $table->index(['school_id', 'student_id']);
        });

        DB::statement("alter table consent_requests add constraint consent_requests_policy_check check (policy in ('one_parent', 'both_parents'))");

        Schema::create('consent_responses', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('consent_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('guardian_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('decision'); // approved|rejected
            $table->timestampTz('decided_at');
            $table->timestampsTz();
            $table->unique(['consent_request_id', 'student_id', 'guardian_user_id']);
            $table->index(['school_id', 'consent_request_id']);
        });

        DB::statement("alter table consent_responses add constraint consent_responses_decision_check check (decision in ('approved', 'rejected'))");

        Schema::create('import_batches', function (Blueprint $table): void {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('kind'); // students|guardians|staff
            $table->foreignId('file_id')->nullable()->constrained('files')->nullOnDelete();
            $table->string('status')->default('pending'); // pending|processing|done|failed
            $table->unsignedInteger('rows_total')->default(0);
            $table->unsignedInteger('rows_ok')->default(0);
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestampsTz();
            $table->index(['school_id', 'status']);
        });

        DB::statement("alter table import_batches add constraint import_batches_kind_check check (kind in ('students', 'guardians', 'staff'))");
        DB::statement("alter table import_batches add constraint import_batches_status_check check (status in ('pending', 'processing', 'done', 'failed'))");

        Schema::create('import_errors', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('batch_id')->constrained('import_batches')->cascadeOnDelete();
            $table->unsignedInteger('row_number');
            $table->text('message');
            $table->timestampsTz();
            $table->index(['batch_id', 'row_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('import_errors');
        Schema::dropIfExists('import_batches');
        Schema::dropIfExists('consent_responses');
        Schema::dropIfExists('consent_requests');
    }
};
