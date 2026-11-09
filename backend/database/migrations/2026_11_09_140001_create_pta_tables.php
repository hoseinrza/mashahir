<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pta_meetings', function (Blueprint $table): void {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->timestampTz('held_at');
            $table->string('location')->nullable();
            $table->jsonb('agenda')->nullable();       // list<string>
            $table->text('minutes')->nullable();       // صورت‌جلسه
            $table->jsonb('resolutions')->nullable();  // list<string>
            $table->string('status')->default('upcoming'); // upcoming|held|cancelled
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestampsTz();
            $table->index(['school_id', 'held_at']);
        });

        Schema::create('pta_surveys', function (Blueprint $table): void {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->jsonb('options');                   // [{id, text}]
            $table->string('policy')->default('per_guardian'); // per_guardian|per_family
            $table->timestampTz('closes_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestampsTz();
            $table->index(['school_id', 'is_active']);
        });

        Schema::create('pta_votes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pta_survey_id')->constrained('pta_surveys')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // One ballot per voter under per_guardian, one per family under
            // per_family (two separated guardians of the same child share it).
            $table->string('family_key');
            $table->string('option_id');
            $table->timestampsTz();
            $table->unique(['pta_survey_id', 'user_id']);
            $table->index(['pta_survey_id', 'family_key']);
        });

        DB::statement("alter table pta_meetings add constraint pta_meetings_status_check check (status in ('upcoming', 'held', 'cancelled'))");
        DB::statement("alter table pta_surveys add constraint pta_surveys_policy_check check (policy in ('per_guardian', 'per_family'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('pta_votes');
        Schema::dropIfExists('pta_surveys');
        Schema::dropIfExists('pta_meetings');
    }
};
