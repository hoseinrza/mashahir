<?php

namespace App\Modules\Academic\Models;

use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;

class AcademicYear extends Model
{
    use BelongsToSchool;

    protected $fillable = ['title', 'starts_on', 'ends_on', 'is_current'];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
            'archived_at' => 'datetime',
            'is_current' => 'boolean',
        ];
    }
}
