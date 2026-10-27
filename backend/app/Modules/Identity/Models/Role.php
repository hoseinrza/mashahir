<?php

namespace App\Modules\Identity\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Role extends Model
{
    protected $fillable = ['school_id', 'key', 'title', 'is_system'];

    /**
     * System roles are global (school_id null); schools may define custom ones.
     */
    public function scopeSystem(Builder $query): Builder
    {
        return $query->whereNull('school_id')->where('is_system', true);
    }

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'role_permissions')
            ->withPivot('condition')
            ->withTimestamps();
    }
}
