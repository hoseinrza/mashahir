<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bus_routes', function (Blueprint $table): void {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('code'); // خط ۱، خط ۲ …
            $table->string('title');
            $table->foreignId('driver_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('vehicle_model')->nullable();
            $table->string('plate_number')->nullable();
            $table->unsignedSmallInteger('capacity')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->unique(['school_id', 'code']);
        });

        Schema::create('bus_stops', function (Blueprint $table): void {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('bus_route_id')->constrained('bus_routes')->cascadeOnDelete();
            $table->string('title');
            $table->unsignedSmallInteger('position')->default(1);
            $table->string('pickup_time', 5)->nullable(); // HH:MM
            $table->timestampsTz();
            $table->index(['bus_route_id', 'position']);
        });

        Schema::create('bus_assignments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('bus_route_id')->constrained('bus_routes')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('bus_stop_id')->nullable()->constrained('bus_stops')->nullOnDelete();
            $table->timestampsTz();
            $table->unique(['bus_route_id', 'student_id']);
        });

        // One row per learner per direction per day; the driver flips it.
        Schema::create('bus_boardings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('bus_route_id')->constrained('bus_routes')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->date('boarding_date');
            $table->string('direction', 3); // in|out
            $table->string('status'); // boarded|absent
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('recorded_at');
            $table->timestampsTz();
            $table->unique(['bus_route_id', 'student_id', 'boarding_date', 'direction']);
            $table->index(['school_id', 'boarding_date']);
        });

        DB::statement("alter table bus_boardings add constraint bus_boardings_direction_check check (direction in ('in', 'out'))");
        DB::statement("alter table bus_boardings add constraint bus_boardings_status_check check (status in ('boarded', 'absent'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('bus_boardings');
        Schema::dropIfExists('bus_assignments');
        Schema::dropIfExists('bus_stops');
        Schema::dropIfExists('bus_routes');
    }
};
