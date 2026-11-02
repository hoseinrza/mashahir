<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A report-card line now can hold an aggregated /20 mean: when one subject has
 * several approved exams in a term, publishing folds them into the single
 * per-subject line the card is allowed to carry — and a mean is rarely a whole
 * number.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('report_card_lines', function (Blueprint $table): void {
            $table->decimal('score', 6, 2)->change();
        });
    }

    public function down(): void
    {
        \Illuminate\Support\Facades\DB::statement(
            'alter table report_card_lines alter column score type integer using round(score)',
        );
    }
};
