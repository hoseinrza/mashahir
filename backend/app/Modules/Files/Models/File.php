<?php

namespace App\Modules\Files\Models;

use App\Support\Concerns\BelongsToSchool;
use App\Support\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;

class File extends Model
{
    use BelongsToSchool;
    use HasUlid;

    protected $table = 'files';

    protected $fillable = ['disk', 'path', 'original_name', 'mime', 'size', 'checksum', 'uploaded_by'];
}
