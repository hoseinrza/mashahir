<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A student leaves the roster without taking their history with them: the row
 * is soft-deleted, so attendance, marks, enrolments and consents stay put for
 * a restore or an audit. The roster's unique code then has to ignore removed
 * rows — once a student is gone their code may be issued again.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table): void {
            $table->softDeletesTz();
        });

        DB::statement('alter table students drop constraint students_school_id_student_code_unique');
        DB::statement(
            'create unique index students_school_id_student_code_unique on students (school_id, student_code) where deleted_at is null'
        );
    }

    public function down(): void
    {
        DB::statement('drop index if exists students_school_id_student_code_unique');
        DB::statement(
            'alter table students add constraint students_school_id_student_code_unique unique (school_id, student_code)'
        );

        Schema::table('students', function (Blueprint $table): void {
            $table->dropSoftDeletesTz();
        });
    }
};
