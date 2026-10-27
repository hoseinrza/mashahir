<?php

namespace App\Modules\People\Models;

use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A court order restricting a guardian's access. Restrictions OVERRIDE link
 * flags — even an enabled flag stays ineffective while restricted.
 */
class CourtOrder extends Model
{
    use BelongsToSchool;

    protected $fillable = [
        'guardian_link_id', 'student_id', 'restrictions', 'file_id',
        'registered_by', 'valid_from', 'valid_to',
    ];

    protected function casts(): array
    {
        return [
            'restrictions' => 'array',
            'valid_from' => 'date',
            'valid_to' => 'date',
        ];
    }

    public function guardianLink(): BelongsTo
    {
        return $this->belongsTo(GuardianLink::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function file(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Files\Models\File::class, 'file_id');
    }
}
