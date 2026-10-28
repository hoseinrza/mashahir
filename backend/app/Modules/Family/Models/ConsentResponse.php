<?php

namespace App\Modules\Family\Models;

use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsentResponse extends Model
{
    use BelongsToSchool;

    public const DECISION_APPROVED = 'approved';
    public const DECISION_REJECTED = 'rejected';

    protected $fillable = [
        'consent_request_id', 'student_id', 'guardian_user_id', 'decision', 'decided_at',
    ];

    protected function casts(): array
    {
        return [
            'decided_at' => 'datetime',
        ];
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(ConsentRequest::class, 'consent_request_id');
    }

    public function guardian(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Identity\Models\User::class, 'guardian_user_id');
    }
}
