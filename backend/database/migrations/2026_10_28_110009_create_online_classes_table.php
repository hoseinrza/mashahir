<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            // Skyroom user id, provisioned lazily on first class entry.
            $table->unsignedBigInteger('skyroom_user_id')->nullable()->index();
        });

        Schema::create('online_classes', function (Blueprint $table): void {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('classroom_subject_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->unsignedBigInteger('skyroom_room_id')->nullable();
            $table->string('skyroom_name')->nullable()->unique();
            $table->string('status')->default('active'); // active|closed
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestampsTz();
            $table->index(['school_id', 'status']);
        });

        DB::statement("alter table online_classes add constraint online_classes_status_check check (status in ('active', 'closed'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('online_classes');
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('skyroom_user_id');
        });
    }
};
