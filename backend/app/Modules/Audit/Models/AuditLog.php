<?php

namespace App\Modules\Audit\Models;

use App\Support\Concerns\AppendOnly;
use Illuminate\Database\Eloquent\Model;

/**
 * Append-only event log. No updated_at, no mutations — enforced by the
 * AppendOnly trait AND a database trigger.
 */
class AuditLog extends Model
{
    use AppendOnly;

    public const UPDATED_AT = null;

    protected $fillable = [
        'school_id', 'actor_id', 'action', 'subject_type', 'subject_id',
        'old', 'new', 'reason', 'ip', 'user_agent', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'old' => 'array',
            'new' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function actor(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(\App\Modules\Identity\Models\User::class, 'actor_id');
    }
}
