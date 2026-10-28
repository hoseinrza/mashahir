<?php

namespace App\Modules\Imports\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Imports\Models\ImportBatch;
use App\Modules\Imports\Services\StudentCsvImporter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * FR-34: bulk data entry from CSV/Excel with per-row error reporting.
 * (XLSX binary support needs a spreadsheet package decision; CSV accepted
 * everywhere Excel exports.)
 */
class ImportsApiController extends Controller
{
    public function store(Request $request, StudentCsvImporter $importer): JsonResponse
    {
        $this->authorize('imports.run');

        $data = $request->validate([
            'file' => ['required', 'file', 'mimetypes:text/csv,text/plain,application/vnd.ms-excel', 'max:2048'],
        ]);

        $batch = $importer->import($data['file']->getRealPath(), $request->user());

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
