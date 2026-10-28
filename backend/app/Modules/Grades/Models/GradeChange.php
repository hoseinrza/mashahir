<?php

namespace App\Modules\Grades\Models;

use App\Support\Concerns\AppendOnly;
use Illuminate\Database\Eloquent\Model;

class GradeChange extends Model
{
    use AppendOnly;

    public $timestamps = false;

    protected $fillable = [
        'grade_item_id', 'old_score', 'new_score', 'reason', 'changed_by', 'changed_at',
    ];

    protected function casts(): array
    {
        return [
            'changed_at' => 'datetime',
        ];
    }
}
