<?php

namespace App\Modules\Grades\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Grades\Models\ReportCard;
use App\Modules\Grades\Services\ReportCardSheetService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * FR-26 + the monthly-cycle closing step: the printed card. One template, one
 * scoping rule, used for a single card and for the principal's bulk run — a
 * page of paper can never carry data the screen was not allowed to show.
 */
class ReportCardPrintController extends Controller
{
    public function __construct(private readonly ReportCardSheetService $sheets)
    {
    }

    /** GET /report-cards/{card}/export */
    public function single(Request $request, ReportCard $card): Response
    {
        $this->authorize('reportcards.export_pdf');

        // The bound card must also sit inside the caller's own visible set; a
        // guessed ulid from another family in the same school is not a window
        // into that family's grades.
        $scoped = $this->sheets->visibleQuery($request, publishedOnly: true)->where('id', $card->id)->first();

        abort_unless($scoped !== null, 404);

        return $this->render($request, collect([$scoped]));
    }

    /**
     * GET /report-cards/print?students=a,b,c | all=1 &kind=in_person
     * One A4 sheet per selected report card, in the order of the roster.
     */
    public function bundle(Request $request): Response
    {
        $this->authorize('reportcards.export_pdf');

        $data = $request->validate([
            'students' => ['nullable', 'string'],
            'all' => ['nullable', 'in:1,true'],
            'kind' => ['nullable', 'in:'.ReportCard::KIND_IN_PERSON.','.ReportCard::KIND_ONLINE],
        ]);

        $ulids = collect(explode(',', $data['students'] ?? ''))
            ->map(fn (string $ulid) => trim($ulid))
            ->filter()
            ->unique()
            ->values()
            ->all();

        // `all=1` without a selection still stops at the role ceiling, and the
        // cap is applied by the query itself, not by a message afterwards.
        if ($ulids === [] && ($data['all'] ?? null) === null) {
            abort(422, 'برای چاپ دسته‌جمعی حداقل یک دانش‌آموز انتخاب کنید.');
        }

        $cards = $this->sheets->visibleCards($request, [
            'student_ulids' => $ulids,
            'kind' => $data['kind'] ?? null,
            'published_only' => true,
            'limit' => ReportCardSheetService::MAX_SHEETS,
        ]);

        if ($cards->isEmpty()) {
            abort(404, 'کارنامه منتشرشده‌ای برای انتخاب شما پیدا نشد.');
        }

        return $this->render($request, $cards);
    }

    private function render(Request $request, \Illuminate\Support\Collection $cards): Response
    {
        $html = view('grades.print.document', $this->sheets->document($request, $cards))->render();

        return response($html, 200, ['Content-Type' => 'text/html; charset=utf-8']);
    }
}
