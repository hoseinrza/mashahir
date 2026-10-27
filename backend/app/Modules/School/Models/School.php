<?php

namespace App\Modules\School\Models;

use App\Support\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;

class School extends Model
{
    use HasUlid;

    public const LEVEL_HIGH = 'high';
    public const LEVEL_MIDDLE = 'middle';
    public const LEVEL_ELEMENTARY = 'elementary';

    protected $fillable = ['name', 'level', 'grading_type', 'student_has_account', 'timezone', 'is_active'];

    protected function casts(): array
    {
        return [
            'student_has_account' => 'boolean',
            'is_active' => 'boolean',
        ];
    }
}
