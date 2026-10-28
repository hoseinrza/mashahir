<?php

namespace App\Modules\Grades\Models;

use App\Support\Concerns\BelongsToSchool;
use App\Support\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ReportCard extends Model
{
    use BelongsToSchool;
    use HasUlid;

    public const KIND_IN_PERSON = 'in_person';
    public const KIND_ONLINE = 'online';

    public const STATUS_DRAFT = 'draft';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_PUBLISHED = 'published';
    public const STATUS_SUPERSEDED = 'superseded';

    protected $fillable = [
        'student_id', 'term_id', 'kind', 'version', 'status',
        'template_key', 'published_by', 'published_at',
    ];

    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\People\Models\Student::class);
    }

    public function term(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Academic\Models\Term::class, 'term_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(ReportCardLine::class);
    }
}
