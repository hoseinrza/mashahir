<?php

namespace App\Modules\Identity\Models;

use Illuminate\Database\Eloquent\Model;

class Permission extends Model
{
    protected $fillable = ['key', 'title', 'group'];
}
