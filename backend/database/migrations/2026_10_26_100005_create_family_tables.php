<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('guardian_links', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('guardian_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->string('link_type');
            $table->boolean('can_view_grades')->default(false);
            $table->boolean('can_view_attendance')->default(false);
            $table->boolean('can_approve_consent')->default(false);
            $table->boolean('can_pickup')->default(false);
            $table->boolean('can_receive_sms')->default(false);
            $table->string('status')->default('pending');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('approved_at')->nullable();
            $table->date('ends_on')->nullable();
            $table->timestampsTz();
            $table->index(['school_id', 'student_id']);
            $table->index(['school_id', 'guardian_user_id']);
        });

        // A guardian–student pair may hold only one active link.
        DB::statement("create unique index guardian_links_one_active_per_pair on guardian_links (guardian_user_id, student_id) where status = 'active'");
        DB::statement("alter table guardian_links add constraint guardian_links_type_check check (link_type in ('primary', 'second', 'separated_joint', 'separated_limited', 'legal_guardian', 'temporary', 'pickup_only'))");
        DB::statement("alter table guardian_links add constraint guardian_links_status_check check (status in ('pending', 'active', 'ended', 'rejected'))");

        Schema::create('court_orders', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('guardian_link_id')->nullable()->constrained('guardian_links')->nullOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            // Structured restrictions overriding guardian flags, e.g. {"can_pickup": false}
            $table->jsonb('restrictions')->nullable();
            $table->foreignId('file_id')->nullable()->constrained('files')->nullOnDelete();
            $table->foreignId('registered_by')->constrained('users')->cascadeOnDelete();
            $table->date('valid_from')->nullable();
            $table->date('valid_to')->nullable();
            $table->timestampsTz();
            $table->index(['school_id', 'student_id']);
        });

        Schema::create('pickup_authorizations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->string('full_name');
            $table->text('phone'); // encrypted at rest
            $table->string('relation')->nullable();
            $table->foreignId('guardian_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status')->default('active');
            $table->boolean('locked')->default(false);
            $table->timestampsTz();
            $table->index(['school_id', 'student_id']);
        });

        DB::statement("alter table pickup_authorizations add constraint pickup_authorizations_status_check check (status in ('active', 'inactive'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('pickup_authorizations');
        Schema::dropIfExists('court_orders');
        Schema::dropIfExists('guardian_links');
    }
};
