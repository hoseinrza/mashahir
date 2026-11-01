<?php

namespace App\Modules\Assignments\Models;

use App\Modules\Files\Models\File;
use App\Support\Concerns\BelongsToSchool;
use App\Support\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Assignment extends Model
{
    use BelongsToSchool;
    use HasUlid;

    protected $fillable = [
        'classroom_subject_id', 'title', 'description', 'due_at',
        'max_score', 'group_ulid', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'due_at' => 'datetime',
        ];
    }

    public function classroomSubject(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Academic\Models\ClassroomSubject::class);
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class);
    }

    /** The assignment sheet itself (PDF/image the teacher attaches). */
    public function files(): BelongsToMany
    {
        return $this->belongsToMany(File::class, 'assignment_files');
    }
}
