<?php

namespace App\Modules\Imports\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Imports\Models\ImportBatch;
use App\Modules\Imports\Services\SpreadsheetReader;
use App\Modules\Imports\Services\StudentCsvImporter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * FR-34: bulk data entry from CSV/Excel with per-row error reporting.
 * xlsx is parsed server-side with ZipArchive+XML (no spreadsheet package);
 * the old binary .xls is refused with a conversion hint.
 */
class ImportsApiController extends Controller
{
    public function store(Request $request, StudentCsvImporter $importer): JsonResponse
    {
        $this->authorize('imports.run');

        // A real .xls is an OLE2 container, and no MIME guesser calls that
        // application/vnd.ms-excel — it would die in validation with a generic
        // "wrong file type" message. Match the signature first so the uploader
        // gets the conversion hint instead.
        $file = $request->file('file');
        if ($file !== null && SpreadsheetReader::looksLikeLegacyXls((string) $file->getRealPath())) {
            throw ValidationException::withMessages(['file' => SpreadsheetReader::LEGACY_XLS_MESSAGE]);
        }

        $data = $request->validate([
            'file' => ['required', 'file', 'mimetypes:text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'max:2048'],
        ]);

        try {
            $batch = $importer->import($data['file']->getRealPath(), $request->user());
        } catch (RuntimeException $e) {
            // Reader-level failures (broken xlsx, legacy .xls) answer in the
            // caller's language; per-row problems are reported in the batch.
            throw ValidationException::withMessages(['file' => $e->getMessage()]);
        }

        return response()->json([
            'ulid' => $batch->ulid,
            'status' => $batch->status,
            'rows_total' => $batch->rows_total,
            'rows_ok' => $batch->rows_ok,
        ], 201);
    }

    public function show(ImportBatch $batch): JsonResponse
    {
        $this->authorize('imports.run');

        return response()->json([
            'ulid' => $batch->ulid,
            'kind' => $batch->kind,
            'status' => $batch->status,
            'rows_total' => $batch->rows_total,
            'rows_ok' => $batch->rows_ok,
            'errors' => $batch->errors()->orderBy('row_number')->get()->map(fn ($e) => [
                'row_number' => $e->row_number,
                'message' => $e->message,
            ]),
        ]);
    }
}
