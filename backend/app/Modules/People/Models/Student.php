<?php

namespace App\Modules\People\Models;

use App\Support\Concerns\BelongsToSchool;
use App\Support\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Student extends Model
{
    use BelongsToSchool;
    use HasUlid;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_LEFT = 'left';
    public const STATUS_GRADUATED = 'graduated';

    protected $fillable = [
        'user_id', 'student_code', 'first_name', 'last_name', 'birth_date',
        'national_code', 'status', 'left_on',
    ];

    protected $hidden = ['national_code'];

    protected function casts(): array
    {
        return [
            'national_code' => 'encrypted',
            'birth_date' => 'date',
            'left_on' => 'date',
            'anonymized_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Identity\Models\User::class);
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(\App\Modules\Academic\Models\Enrollment::class);
    }

    public function fullName(): string
    {
        return trim($this->first_name.' '.$this->last_name);
    }
}
