<?php

namespace App\Modules\Identity\Models;

use App\Support\Concerns\HasUlid;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasUlid, Notifiable;

    protected $fillable = ['first_name', 'last_name', 'phone', 'phone_hash', 'status'];

    protected $hidden = ['phone', 'phone_hash'];

    protected function casts(): array
    {
        return [
            'phone' => 'encrypted',
            'last_login_at' => 'datetime',
        ];
    }

    public function fullName(): string
    {
        return trim($this->first_name.' '.$this->last_name);
    }

    public function staffProfiles(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(StaffProfile::class);
    }

    public function userRoles(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(UserRole::class);
    }
}
