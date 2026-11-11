<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Closes the model gaps surfaced by the family-domain audit:
 * court orders carry no ruling metadata, guardian links carry no
 * verification document / office note, and the pickup list has no
 * national id to verify a person at the gate.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('guardian_links', function (Blueprint $table): void {
            // Same document reference pattern as court_orders.file_id.
            $table->foreignId('verification_file_id')->nullable()->constrained('files')->nullOnDelete();
            $table->text('admin_note')->nullable();
        });

        Schema::table('court_orders', function (Blueprint $table): void {
            $table->string('ruling_number', 100)->nullable();
            $table->string('issuing_authority', 200)->nullable();
            $table->text('description')->nullable();
        });

        Schema::table('pickup_authorizations', function (Blueprint $table): void {
            // Encrypted at rest (see PickupAuthorization::$casts), like phone.
            $table->string('national_id')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('guardian_links', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('verification_file_id');
            $table->dropColumn('admin_note');
        });

        Schema::table('court_orders', function (Blueprint $table): void {
            $table->dropColumn(['ruling_number', 'issuing_authority', 'description']);
        });

        Schema::table('pickup_authorizations', function (Blueprint $table): void {
            $table->dropColumn('national_id');
        });
    }
};
