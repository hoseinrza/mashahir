<?php

namespace App\Modules\People\Models;

use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PickupAuthorization extends Model
{
    use BelongsToSchool;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';

    protected $fillable = ['student_id', 'full_name', 'phone', 'relation', 'guardian_user_id', 'status', 'locked'];

    protected $hidden = ['phone'];

    protected function casts(): array
    {
        return [
            'phone' => 'encrypted',
            'locked' => 'boolean',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function guardian(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Identity\Models\User::class, 'guardian_user_id');
    }
}
