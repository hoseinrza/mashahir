<?php

namespace App\Modules\Imports\Models;

use App\Support\Concerns\BelongsToSchool;
use App\Support\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ImportBatch extends Model
{
    use BelongsToSchool;
    use HasUlid;

    public const STATUS_PENDING = 'pending';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_DONE = 'done';
    public const STATUS_FAILED = 'failed';

    protected $fillable = ['kind', 'file_id', 'status', 'rows_total', 'rows_ok', 'created_by'];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Identity\Models\User::class, 'created_by');
    }

    public function errors(): HasMany
    {
        return $this->hasMany(ImportError::class, 'batch_id')->orderBy('row_number');
    }
}
