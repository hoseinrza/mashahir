<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action');
            $table->string('subject_type')->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->jsonb('old')->nullable();
            $table->jsonb('new')->nullable();
            $table->text('reason')->nullable();
            $table->string('ip', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestampTz('created_at')->nullable()->useCurrent();
            $table->index(['school_id', 'subject_type', 'subject_id', 'created_at']);
        });

        // Append-only at the database level: no role may update or delete.
        DB::statement("create or replace function app_forbid_mutation() returns trigger as \$\$
            begin
                raise exception '% is append-only', TG_TABLE_NAME;
            end
        \$\$ language plpgsql");
        DB::statement('create trigger audit_logs_append_only before update or delete on audit_logs for each row execute function app_forbid_mutation()');
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        DB::statement('drop function if exists app_forbid_mutation()');
    }
};
