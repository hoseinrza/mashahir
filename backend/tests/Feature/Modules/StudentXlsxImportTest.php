<?php

namespace Tests\Feature\Modules;

use App\Modules\Identity\Models\User;
use App\Modules\Imports\Services\SpreadsheetReader;
use App\Modules\People\Models\Student;
use App\Support\PhoneHash;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;
use ZipArchive;

class StudentXlsxImportTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();
        $this->actingWithRole('school_admin');
    }

    /**
     * A minimal, reader-shaped workbook: workbook.xml + rels + sheet1.xml,
     * strings inline and the first student_code a plain number cell — the two
     * shapes real Excel exports produce.
     */
    private function buildXlsx(string $path): void
    {
        $main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
        $r = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

        $workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<workbook xmlns="'.$main.'" xmlns:r="'.$r.'">'
            .'<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>';

        $rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="'.$r.'/worksheet" Target="worksheets/sheet1.xml"/>'
            .'</Relationships>';

        $cell = fn (string $ref, string $text) => '<c r="'.$ref.'" t="inlineStr"><is><t>'.$text.'</t></is></c>';
        $numberCell = fn (string $ref, string $value) => '<c r="'.$ref.'"><v>'.$value.'</v></c>';

        $sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<worksheet xmlns="'.$main.'"><sheetData>'
            .'<row r="1">'
            .$cell('A1', 'student_code').$cell('B1', 'first_name').$cell('C1', 'last_name').$cell('D1', 'phone')
            .'</row>'
            .'<row r="2">'
            .$cell('A2', 'S3001').$cell('B2', 'امیر').$cell('C2', 'رضازاده').$cell('D2', '09121112005')
            .'</row>'
            .'<row r="3">'
            .$numberCell('A3', '3002').$cell('B3', 'سارا').$cell('C3', 'موسوی').$cell('D3', '۰۹۱۲۱۱۱۲۰۰۶')
            .'</row>'
            .'<row r="4">'
            .$cell('A4', 'S3003').$cell('B4', 'شاگرد').$cell('C4', 'بدشماره').$cell('D4', '12345')
            .'</row>'
            .'</sheetData></worksheet>';

        $zip = new ZipArchive;
        $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $zip->addFromString('xl/workbook.xml', $workbook);
        $zip->addFromString('xl/_rels/workbook.xml.rels', $rels);
        $zip->addFromString('xl/worksheets/sheet1.xml', $sheet);
        $zip->close();
    }

    public function test_an_xlsx_roster_imports_with_phones_and_reports_bad_rows(): void
    {
        $path = sys_get_temp_dir().'/students-'.uniqid().'.xlsx';
        $this->buildXlsx($path);
        $file = new UploadedFile($path, 'students.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/v1/imports/students', ['file' => $file])->assertCreated();
        $this->assertSame(2, $response->json('rows_ok'));

        // The numeric cell arrives as the plain digits; Persian digits normalize.
        $this->assertNotNull(User::query()->where('phone_hash', PhoneHash::of('09121112005'))->first());
        $this->assertNotNull(User::query()->where('phone_hash', PhoneHash::of('09121112006'))->first());
        $this->assertDatabaseHas('students', ['student_code' => '3002']);
        $this->assertDatabaseMissing('students', ['student_code' => 'S3003']);

        $batch = \App\Modules\Imports\Models\ImportBatch::query()->latest('id')->firstOrFail();
        $this->assertSame('done', $batch->status);
        $errors = collect($this->getJson("/api/v1/imports/{$batch->ulid}")->assertOk()->json('errors'));
        $this->assertStringContainsString('شماره موبایل', (string) $errors->firstWhere('row_number', 4)['message']);

        @unlink($path);
    }

    /**
     * The shape Microsoft Excel actually writes: shared strings (one of them a
     * rich-text run), two worksheets, and the roster sheet first in workbook
     * order while stored under a non-default part name.
     */
    private function buildSharedStringsXlsx(string $path): void
    {
        $main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
        $r = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

        $workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<workbook xmlns="'.$main.'" xmlns:r="'.$r.'"><sheets>'
            .'<sheet name="Roster" sheetId="1" r:id="rId5"/>'
            .'<sheet name="Notes" sheetId="2" r:id="rId6"/>'
            .'</sheets></workbook>';

        // rId5 points at an absolute part name, rId6 at the usual sheet1.xml:
        // the reader must follow the relationship of the FIRST workbook sheet.
        $rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId5" Type="'.$r.'/worksheet" Target="/xl/worksheets/data.xml"/>'
            .'<Relationship Id="rId6" Type="'.$r.'/worksheet" Target="worksheets/sheet1.xml"/>'
            .'</Relationships>';

        $strings = ['student_code', 'first_name', 'last_name', 'phone', 'S5001', 'امیر', 'رضایی', '09121114001', 'S5002', 'سارا', 'موسوی'];
        $sst = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<sst xmlns="'.$main.'" count="'.count($strings).'" uniqueCount="'.count($strings).'">';
        foreach ($strings as $i => $text) {
            $sst .= $i === 5
                ? '<si><r><rPr><b/></rPr><t>'.$text.'</t></r></si>'
                : '<si><t>'.$text.'</t></si>';
        }
        $sst .= '</sst>';

        $str = fn (string $ref, int $index) => '<c r="'.$ref.'" t="s"><v>'.$index.'</v></c>';

        $roster = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<worksheet xmlns="'.$main.'"><sheetData>'
            .'<row r="1">'.$str('A1', 0).$str('B1', 1).$str('C1', 2).$str('D1', 3).'</row>'
            .'<row r="2">'.$str('A2', 4).$str('B2', 5).$str('C2', 6).$str('D2', 7).'</row>'
            .'<row r="3">'.$str('A3', 8).$str('B3', 9).$str('C3', 10).'</row>'
            .'</sheetData></worksheet>';

        // Decoy: the second workbook sheet, stored as sheet1.xml — reading it
        // by part name instead of workbook order would import THIS header.
        $decoy = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<worksheet xmlns="'.$main.'"><sheetData>'
            .'<row r="1"><c r="A1" t="inlineStr"><is><t>student_code</t></is></c></row>'
            .'<row r="2"><c r="A2" t="inlineStr"><is><t>DECOY</t></is></c></row>'
            .'</sheetData></worksheet>';

        $zip = new ZipArchive;
        $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $zip->addFromString('xl/workbook.xml', $workbook);
        $zip->addFromString('xl/_rels/workbook.xml.rels', $rels);
        $zip->addFromString('xl/sharedStrings.xml', $sst);
        $zip->addFromString('xl/worksheets/data.xml', $roster);
        $zip->addFromString('xl/worksheets/sheet1.xml', $decoy);
        $zip->close();
    }

    public function test_a_shared_strings_workbook_reads_the_first_sheet_by_workbook_order(): void
    {
        $path = sys_get_temp_dir().'/students-sst-'.uniqid().'.xlsx';
        $this->buildSharedStringsXlsx($path);
        $file = new UploadedFile($path, 'roster.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->postJson('/api/v1/imports/students', ['file' => $file])->assertCreated();
        $this->assertSame(2, $response->json('rows_ok'));

        // The rich-text shared string resolves to its plain text.
        $this->assertDatabaseHas('students', ['student_code' => 'S5001', 'first_name' => 'امیر', 'last_name' => 'رضایی']);
        $this->assertNotNull(User::query()->where('phone_hash', PhoneHash::of('09121114001'))->first());

        // The decoy worksheet was never touched.
        $this->assertDatabaseMissing('students', ['student_code' => 'DECOY']);

        @unlink($path);
    }

    public function test_a_legacy_xls_is_refused_with_a_conversion_hint(): void
    {
        $path = sys_get_temp_dir().'/students-'.uniqid().'.xls';
        file_put_contents($path, "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1".str_repeat("\0", 512));
        $file = new UploadedFile($path, 'roster.xls', 'application/vnd.ms-excel', null, true);

        $this->postJson('/api/v1/imports/students', ['file' => $file])
            ->assertStatus(422)
            ->assertJsonPath('errors.file.0', SpreadsheetReader::LEGACY_XLS_MESSAGE);

        @unlink($path);
    }
}
