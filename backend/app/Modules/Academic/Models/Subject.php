<?php

namespace App\Modules\Academic\Models;

use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;

class Subject extends Model
{
    use BelongsToSchool;

    protected $fillable = ['title', 'code'];
}
