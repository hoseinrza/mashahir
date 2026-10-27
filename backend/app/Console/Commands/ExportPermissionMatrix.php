<?php

namespace App\Console\Commands;

use App\Support\Rbac\PermissionMatrix;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class ExportPermissionMatrix extends Command
{
    protected $signature = 'matrix:export {--output=../docs/permission-matrix.md}';

    protected $description = 'Generate the human-readable permission matrix document from the single-source matrix file';

    public function handle(): int
    {
        $data = PermissionMatrix::load();
        $roles = PermissionMatrix::roles();
        $roleKeys = array_keys($roles);
        $roleTitles = array_map(fn (array $role) => $role['title'], $roles);

        $lines = [];
        $lines[] = '# ماتریس مجوزها — مدرسه مشاهیر آینده';
        $lines[] = '';
        $lines[] = '> تولیدشده‌ی خودکار از `backend/app/Support/Rbac/permission_matrix.php` (فایل واحد منبع حقیقت). این سند را دستی ویرایش نکنید؛ سلول‌های `REVIEW` را در `docs/permission-matrix-review.md` ببینید.';
        $lines[] = '';
        $lines[] = 'منبع اصل: '.$data['meta']['source'];
        $lines[] = '';
        $lines[] = 'علامت‌ها: `✓` = مجاز در محدوده نقش، `شn` = مجاز به شرط n، `—` = مجاز نیست (پیش‌فرض ممنوع).';
        $lines[] = '';

        foreach ($data['permissions'] as $group => $entries) {
            $lines[] = '## '.$group;
            $lines[] = '';
            $lines[] = '| کلید | مجوز | '.implode(' | ', $roleTitles).' |';
            $lines[] = '|---|---|'.implode('|', array_fill(0, count($roleKeys), ':---:')).'|';

            foreach ($entries as $entry) {
                $grants = $data['matrix'][$entry['key']] ?? [];
                $cells = [];

                foreach ($roleKeys as $roleKey) {
                    $cells[] = $this->formatCell($grants[$roleKey] ?? null);
                }

                $lines[] = '| `'.$entry['key'].'` | '.$entry['title'].' | '.implode(' | ', $cells).' |';
            }

            $lines[] = '';
        }

        $lines[] = '## قیدهای شرطی';
        $lines[] = '';

        foreach ($data['conditions'] as $code => $text) {
            $lines[] = '- **'.$code.'**: '.$text;
        }

        $lines[] = '';

        $output = base_path($this->option('output'));
        File::ensureDirectoryExists(dirname($output));
        File::put($output, implode("\n", $lines));

        $this->info("Permission matrix exported to {$output}");

        return self::SUCCESS;
    }

    private function formatCell(mixed $value): string
    {
        if ($value === null) {
            return '—';
        }

        if (is_array($value)) {
            return implode('، ', $value);
        }

        return is_string($value) ? $value : '✓';
    }
}
