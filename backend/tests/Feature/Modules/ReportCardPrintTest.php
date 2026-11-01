<?php

namespace Tests\Feature\Modules;

use App\Modules\Grades\Models\GradeItem;
use App\Modules\Grades\Models\ReportCard;
use App\Modules\People\Models\Student;
use App\Support\Jalali;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

/**
 * The printed card is an official document: it must carry exactly the published
 * cards the caller may see — one A4 sheet each, never a draft, never another
 * family's file, whatever the selection string asked for.
 */
class ReportCardPrintTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    private $teacher;

    private $classroom;

    private $subjectId;

    private $termId;

    private $guardian;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();

        $this->teacher = $this->makeUser();
        $this->classroom = $this->makeClassroom();
        $this->subjectId = $this->assignTeacher($this->teacher, $this->classroom, $this->makeSubject())->id;
        $this->termId = $this->makeTerm()->id;

        $this->guardian = $this->makeUser();
    }

    private function studentWithPublishedCard(int $score = 92): Student
    {
        $student = $this->makeStudent();
        $this->enroll($student, $this->classroom);

        $this->actingWithRole('teacher', user: $this->teacher);
        $this->postJson('/api/v1/grades', [
            'student_ulid' => $student->ulid,
            'classroom_subject_id' => $this->subjectId,
            'term_id' => $this->termId,
            'score' => $score,
            'source_type' => 'in_person_exam',
            'delivery' => 'in_person',
        ])->assertCreated();

        $item = GradeItem::query()->where('student_id', $student->id)->latest('id')->firstOrFail();

        $this->actingWithRole('academic_deputy');
        $this->postJson("/api/v1/grades/{$item->id}/approve")->assertOk();

        $this->actingWithRole('school_admin');
        $this->postJson('/api/v1/report-cards/publish', [
            'student_ulid' => $student->ulid,
            'term_id' => $this->termId,
            'kind' => 'in_person',
        ])->assertCreated();

        return $student;
    }

    private function linkGuardian(Student $student, bool $canViewGrades): void
    {
        \App\Modules\People\Models\GuardianLink::query()->create([
            'guardian_user_id' => $this->guardian->id,
            'student_id' => $student->id,
            'link_type' => 'primary',
            'status' => 'active',
            'approved_at' => now(),
            'can_view_grades' => $canViewGrades,
        ]);
    }

    public function test_principal_prints_the_selected_students_in_one_document(): void
    {
        $first = $this->studentWithPublishedCard(92);
        $second = $this->studentWithPublishedCard(70);
        $third = $this->studentWithPublishedCard();

        $this->actingWithRole('school_admin');
        $response = $this->getJson('/api/v1/report-cards/print?students='.$first->ulid.','.$second->ulid)
            ->assertOk()
            ->assertHeader('Content-Type', 'text/html; charset=utf-8');

        $html = $response->getContent();

        $this->assertSame(2, substr_count($html, '<section class="page">'), 'one A4 sheet per selected card');
        $this->assertStringContainsString($first->fullName(), $html);
        $this->assertStringContainsString($second->fullName(), $html);
        $this->assertStringNotContainsString($third->fullName(), $html);

        // Fixed structure: letterhead, identity band, the /20 column, the
        // descriptive band and the signature block are part of every sheet.
        $this->assertStringContainsString($this->school->name, $html);
        $this->assertStringContainsString('مهر و امضای مدیر مدرسه', $html);
        $this->assertStringContainsString('خیلی خوب', $html);
        // The signature block names the staff member who issued the card.
        $this->assertStringContainsString($this->actor->fullName(), $html);
        $this->assertStringContainsString('window.print()', $html);
    }

    public function test_all_flag_prints_every_published_card_of_the_school(): void
    {
        $this->studentWithPublishedCard();
        $this->studentWithPublishedCard();

        $this->actingWithRole('school_admin');
        $html = $this->getJson('/api/v1/report-cards/print?all=1')->assertOk()->getContent();

        $this->assertSame(2, substr_count($html, '<section class="page">'));
    }

    public function test_draft_card_never_reaches_the_paper(): void
    {
        $student = $this->studentWithPublishedCard();

        $draft = ReportCard::query()->create([
            'student_id' => $student->id,
            'term_id' => $this->termId,
            'kind' => ReportCard::KIND_ONLINE,
            'version' => 1,
            'status' => ReportCard::STATUS_DRAFT,
        ]);

        // Staff may read drafts on screen; the printer is not allowed to.
        $this->actingWithRole('school_admin');
        $this->getJson('/api/v1/report-cards')->assertOk();

        $html = $this->getJson('/api/v1/report-cards/print?all=1')->assertOk()->getContent();

        $this->assertStringNotContainsString($draft->ulid, $html);
        $this->assertSame(1, substr_count($html, '<section class="page">'));
    }

    public function test_selection_is_required_and_an_unknown_student_is_not_printable(): void
    {
        $this->studentWithPublishedCard();

        $this->actingWithRole('school_admin');
        $this->getJson('/api/v1/report-cards/print')->assertStatus(422);
        $this->getJson('/api/v1/report-cards/print?students=01ABC_NOT_A_REAL_ULID')->assertNotFound();
    }

    public function test_guardian_prints_only_the_children_allowed_to_see_grades(): void
    {
        $mine = $this->studentWithPublishedCard();
        $other = $this->studentWithPublishedCard();

        $this->linkGuardian($mine, true);
        $this->linkGuardian($other, false);

        $this->actingWithRole('guardian', user: $this->guardian);
        $html = $this->getJson('/api/v1/report-cards/print?students='.$mine->ulid)->assertOk()->getContent();

        $this->assertStringContainsString($mine->fullName(), $html);
        $this->assertStringNotContainsString($other->fullName(), $html);

        // The link exists but the per-link grade flag is off: nothing to print.
        $this->getJson('/api/v1/report-cards/print?students='.$other->ulid)->assertNotFound();

        // A guardian must not be able to buy a bulk run of the whole school.
        $all = $this->getJson('/api/v1/report-cards/print?all=1')->assertOk()->getContent();
        $this->assertStringNotContainsString($other->ulid, $all);
        $this->assertSame(1, substr_count($all, '<section class="page">'));
    }

    public function test_single_export_shares_the_fixed_template_and_stays_in_scope(): void
    {
        $student = $this->studentWithPublishedCard();
        $card = ReportCard::query()->where('student_id', $student->id)->latest('id')->firstOrFail();

        $this->actingWithRole('school_admin');
        $html = $this->getJson('/api/v1/report-cards/'.$card->ulid.'/export')
            ->assertOk()
            ->assertHeader('Content-Type', 'text/html; charset=utf-8')
            ->getContent();

        $this->assertSame(1, substr_count($html, '<section class="page">'));
        $this->assertStringContainsString($card->ulid, $html);
        $this->assertStringContainsString($student->fullName(), $html);

        // A card outside the guardian's own files is invisible, not merely hidden.
        $this->linkGuardian($this->makeStudent(), true);
        $this->actingWithRole('guardian', user: $this->guardian);
        $this->getJson('/api/v1/report-cards/'.$card->ulid.'/export')->assertNotFound();
    }

    public function test_role_without_the_print_permission_is_rejected(): void
    {
        $student = $this->studentWithPublishedCard();
        $card = ReportCard::query()->where('student_id', $student->id)->latest('id')->firstOrFail();

        // The teacher records and edits grades; issuing the official PDF is not
        // his — reportcards.export_pdf is absent for his role.
        $this->actingWithRole('teacher');
        $this->getJson('/api/v1/report-cards/print?all=1')->assertForbidden();
        $this->getJson('/api/v1/report-cards/'.$card->ulid.'/export')->assertForbidden();
    }

    public function test_raw_score_and_its_ceiling_print_together(): void
    {
        $student = $this->studentWithPublishedCard(92);

        $this->actingWithRole('school_admin');
        $html = $this->getJson('/api/v1/report-cards/print?students='.$student->ulid)->assertOk()->getContent();

        // A ۹۲ out of ۱۰۰ prints on the raw column and as ۱۸٫۴۰ on the official
        // /۲۰ column — with Persian digits, never the Latin ones.
        $this->assertStringContainsString(
            Jalali::digits(92).' از '.Jalali::digits(100),
            $html,
        );
        $this->assertStringContainsString(Jalali::digits(number_format(18.4, 2)), $html);
        $this->assertStringNotContainsString('92 از', $html);
    }
}
