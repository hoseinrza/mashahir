<?php

namespace App\Modules\Notifications\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnnouncementTarget extends Model
{
    public const TYPE_SCHOOL = 'school';
    public const TYPE_GRADE_LEVEL = 'grade_level';
    public const TYPE_CLASSROOM = 'classroom';

    protected $fillable = ['announcement_id', 'target_type', 'target_id'];

    public function announcement(): BelongsTo
    {
        return $this->belongsTo(Announcement::class);
    }
}
