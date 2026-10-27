<?php

namespace App\Modules\Identity\Models;

use App\Support\Concerns\BelongsToSchool;
use App\Support\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StaffProfile extends Model
{
    use BelongsToSchool;
    use HasUlid;

    protected $fillable = ['user_id', 'job_title', 'personnel_code', 'status'];

    protected function casts(): array
    {
        return [];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
