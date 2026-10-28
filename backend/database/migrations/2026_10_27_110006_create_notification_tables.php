<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // For guardians: which child the notification is about (filter per child).
            $table->foreignId('student_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('type'); // attendance.absence|attendance.late|consent.request|announcement|exam.result|...
            $table->string('importance')->default('info'); // info|important|urgent
            $table->string('title');
            $table->text('body')->nullable();
            $table->string('link')->nullable();
            $table->jsonb('data')->nullable();
            $table->timestampTz('read_at')->nullable();
            $table->timestampTz('archived_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->index(['user_id', 'read_at', 'created_at']);
            $table->index(['school_id', 'type']);
        });

        DB::statement("alter table notifications add constraint notifications_importance_check check (importance in ('info', 'important', 'urgent'))");

        // One row per channel; SMS failure is tracked independently of push/in-app.
        Schema::create('notification_deliveries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('notification_id')->constrained()->cascadeOnDelete();
            $table->string('channel'); // in_app|sms|push
            $table->string('status')->default('queued'); // queued|sent|failed
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->string('provider_message_id')->nullable();
            $table->timestampTz('sent_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestampTz('next_retry_at')->nullable();
            $table->timestampsTz();
            $table->unique(['notification_id', 'channel']);
            $table->index(['status', 'next_retry_at']);
        });

        DB::statement("alter table notification_deliveries add constraint notification_deliveries_channel_check check (channel in ('in_app', 'sms', 'push'))");
        DB::statement("alter table notification_deliveries add constraint notification_deliveries_status_check check (status in ('queued', 'sent', 'failed'))");

        Schema::create('notification_preferences', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type');
            $table->string('channel');
            $table->boolean('enabled')->default(true);
            $table->timestampsTz();
            $table->unique(['user_id', 'type', 'channel']);
        });

        Schema::create('announcements', function (Blueprint $table): void {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('body');
            $table->string('importance')->default('info');
            $table->foreignId('published_by')->constrained('users')->cascadeOnDelete();
            $table->timestampTz('published_at');
            $table->timestampTz('expires_at')->nullable();
            $table->timestampsTz();
            $table->index(['school_id', 'published_at']);
        });

        DB::statement("alter table announcements add constraint announcements_importance_check check (importance in ('info', 'important', 'urgent'))");

        Schema::create('announcement_targets', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('announcement_id')->constrained()->cascadeOnDelete();
            $table->string('target_type'); // school|grade_level|classroom
            $table->unsignedBigInteger('target_id')->nullable(); // null = whole school
            $table->timestampsTz();
            $table->index(['announcement_id']);
        });

        DB::statement("alter table announcement_targets add constraint announcement_targets_type_check check (target_type in ('school', 'grade_level', 'classroom'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('announcement_targets');
        Schema::dropIfExists('announcements');
        Schema::dropIfExists('notification_preferences');
        Schema::dropIfExists('notification_deliveries');
        Schema::dropIfExists('notifications');
    }
};
