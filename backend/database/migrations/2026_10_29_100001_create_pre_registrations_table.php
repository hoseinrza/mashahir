<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Landing-page intake (پیش‌ثبت‌نام آزمون ورودی): a guest submits the
        // public form; the school processes the row inside the portal.
        Schema::create('pre_registrations', function (Blueprint $table): void {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('tracking_code', 16)->unique();
            $table->string('student_name');
            $table->string('grade', 32);
            $table->string('last_gpa', 8)->nullable();
            $table->string('parent_phone', 20);
            $table->string('current_school')->nullable();
            $table->boolean('has_honor')->default(false);
            $table->string('honor_desc')->nullable();
            $table->string('status')->default('new');
            $table->text('admin_notes')->nullable();
            $table->timestampsTz();
            $table->index(['school_id', 'status']);
            $table->index(['school_id', 'created_at']);
        });

        DB::statement("alter table pre_registrations add constraint pre_registrations_status_check check (status in ('new', 'contacted', 'exam_scheduled', 'accepted', 'waitlist', 'rejected'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('pre_registrations');
    }
};
