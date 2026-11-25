<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Alocom (الوکام) organizer credentials of the school — the password is
        // encrypted at rest via the model's 'encrypted' cast, never returned
        // by any API.
        Schema::table('schools', function (Blueprint $table): void {
            $table->string('alocom_username')->nullable()->index();
            $table->text('alocom_password')->nullable();
        });

        // A class is provisioned on exactly one provider: skyroom (room) or
        // alocom (event). alocom_event_id is the provider's UUID event id and
        // alocom_link the class link returned at creation.
        Schema::table('online_classes', function (Blueprint $table): void {
            $table->string('provider')->default('skyroom');
            $table->string('alocom_event_id', 64)->nullable()->unique();
            $table->string('alocom_link')->nullable();
        });

        DB::statement("alter table online_classes add constraint online_classes_provider_check check (provider in ('skyroom', 'alocom'))");
    }

    public function down(): void
    {
        Schema::table('online_classes', function (Blueprint $table): void {
            $table->dropColumn(['provider', 'alocom_event_id', 'alocom_link']);
        });

        Schema::table('schools', function (Blueprint $table): void {
            $table->dropColumn(['alocom_username', 'alocom_password']);
        });
    }
};
