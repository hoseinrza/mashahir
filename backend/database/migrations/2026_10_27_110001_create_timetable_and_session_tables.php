<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('timetable_slots', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('classroom_subject_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('weekday'); // 0=شنبه … 6=جمعه
            $table->unsignedSmallInteger('period');
            $table->time('starts_at');
            $table->time('ends_at');
            $table->timestampsTz();
            $table->unique(['classroom_subject_id', 'weekday', 'period']);
            $table->index(['school_id', 'weekday']);
        });

        DB::statement('alter table timetable_slots add constraint timetable_slots_time_check check (ends_at > starts_at)');

        // class_sessions lives in 2026_10_27_100008_create_attendance_tables.
    }

    public function down(): void
    {
        Schema::dropIfExists('timetable_slots');
    }
};
