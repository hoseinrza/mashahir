<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('counseling_appointments', function (Blueprint $table): void {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('requester_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('counselor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('topic');
            $table->string('type')->default('in_person'); // in_person|online
            $table->string('status')->default('requested'); // requested|scheduled|completed|cancelled
            $table->timestampTz('scheduled_at')->nullable();
            // What the student/guardian may read after the session.
            $table->text('shared_summary')->nullable();
            // Confidential to the counselor — never leaves the manage scope.
            $table->text('confidential_notes')->nullable();
            $table->text('follow_up_plan')->nullable();
            $table->timestampsTz();
            $table->index(['school_id', 'status']);
            $table->index(['counselor_user_id', 'scheduled_at']);
            $table->index(['student_id', 'created_at']);
        });

        DB::statement("alter table counseling_appointments add constraint counseling_appointments_type_check check (type in ('in_person', 'online'))");
        DB::statement("alter table counseling_appointments add constraint counseling_appointments_status_check check (status in ('requested', 'scheduled', 'completed', 'cancelled'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('counseling_appointments');
    }
};
