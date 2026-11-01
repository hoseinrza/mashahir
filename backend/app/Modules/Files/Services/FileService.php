<?php

namespace App\Modules\Files\Services;

use App\Modules\Files\Models\File;
use App\Modules\Identity\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * The file manager: homework sheets, descriptive exam answers and court
 * documents all flow through here. The declared extension and client mime
 * are never trusted — the real type is detected from the bytes (finfo) and
 * matched against the allowlist. Storage is private; bytes leave the server
 * only through the access-checked stream endpoint.
 */
final class FileService
{
    public const MAX_SIZE_KB = 10240; // 10 MB

    public const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];

    /** Content-detected mimes the allowlist maps to. */
    private const ALLOWED_MIMES = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'application/pdf' => 'pdf',
    ];

    public function store(UploadedFile $upload, User $uploader, int $schoolId): File
    {
        // Content-based detection straight from the bytes — Laravel's
        // getMimeType() trusts the extension first and is bypassable.
        $bytes = (string) $upload->getContent();
        $realMime = strtolower((string) (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes));

        if (! isset(self::ALLOWED_MIMES[$realMime])) {
            throw ValidationException::withMessages([
                'file' => 'فقط تصویر (JPG، PNG، WebP) یا PDF پذیرفته می‌شود.',
            ]);
        }

        $declared = strtolower($upload->getClientOriginalExtension());
        if ($declared !== '' && ! in_array($declared, self::ALLOWED_EXTENSIONS, true)) {
            throw ValidationException::withMessages([
                'file' => 'پسوند فایل باید یکی از انواع تصویر یا PDF باشد.',
            ]);
        }

        if ($upload->getSize() > self::MAX_SIZE_KB * 1024) {
            throw ValidationException::withMessages([
                'file' => 'حجم فایل نباید از '.(self::MAX_SIZE_KB / 1024).' مگابایت بیشتر باشد.',
            ]);
        }

        $ulid = (string) Str::ulid();
        $extension = self::ALLOWED_MIMES[$realMime];
        $disk = 'local';
        $path = "schools/{$schoolId}/files/{$ulid}.{$extension}";

        // Bytes land first: a dangling DB row pointing at nothing is worse
        // than an orphan file with no row.
        Storage::disk($disk)->put($path, $bytes);

        return File::query()->create([
            'ulid' => $ulid,
            'school_id' => $schoolId,
            'disk' => $disk,
            'path' => $path,
            'original_name' => $this->safeOriginalName($upload->getClientOriginalName()),
            'mime' => $realMime,
            'size' => strlen($bytes),
            'checksum' => hash('sha256', $bytes),
            'uploaded_by' => $uploader->id,
        ]);
    }

    /** {ulid, original_name, mime, size} shape shared by every attachment. */
    public function payload(File $file): array
    {
        return [
            'ulid' => $file->ulid,
            'original_name' => $file->original_name,
            'mime' => $file->mime,
            'size' => $file->size,
        ];
    }

    private function safeOriginalName(?string $name): string
    {
        $name = trim((string) $name);
        if ($name === '') {
            return 'file';
        }

        // Header-safe: strip control characters and path separators.
        $clean = preg_replace('/[^\p{L}\p{N}\._\- ]/u', '', $name) ?? 'file';

        return mb_substr($clean, 0, 180) ?: 'file';
    }
}
