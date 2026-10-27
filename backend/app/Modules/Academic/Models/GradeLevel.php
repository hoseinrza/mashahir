<?php

namespace App\Modules\Academic\Models;

use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;

class GradeLevel extends Model
{
    use BelongsToSchool;

    protected $fillable = ['title', 'order'];

    protected function casts(): array
    {
        return [
            'order' => 'integer',
        ];
    }
}
