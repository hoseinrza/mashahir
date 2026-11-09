<?php

namespace App\Modules\Pta\Models;

use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** رأی یک ولی به نظرسنجی؛ family_key سیاست ضدتکرار را اجرا می‌کند. */
class PtaVote extends Model
{
    use BelongsToSchool;

    protected $fillable = ['pta_survey_id', 'user_id', 'family_key', 'option_id'];

    public function survey(): BelongsTo
    {
        return $this->belongsTo(PtaSurvey::class, 'pta_survey_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Identity\Models\User::class);
    }
}
