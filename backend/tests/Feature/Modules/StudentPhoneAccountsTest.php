<?php

namespace Tests\Feature\Modules;

use App\Modules\Identity\Models\User;
use App\Modules\People\Models\Student;
use App\Support\PhoneHash;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

class StudentPhoneAccountsTest extends TestCase
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

    public function test_a_student_with_a_phone_gets_a_login_account_and_student_role(): void
    {
        $this->postJson('/api/v1/students', [
            'student_code' => 'S1001',
            'first_name' => 'امیرحسین',
            'last_name' => 'رضازاده',
            'phone' => '09121112233',
        ])->assertCreated();

        $student = Student::query()->where('student_code', 'S1001')->firstOrFail();
        $user = User::query()->where('phone_hash', PhoneHash::of('09121112233'))->firstOrFail();

        $this->assertSame($user->id, $student->user_id);
        $this->assertSame('09121112233', $user->phone);

        // The student role is scoped to the student's own record (ش۴).
        $this->assertDatabaseHas('user_roles', [
            'user_id' => $user->id,
            'role_id' => \DB::table('roles')->where('key', 'student')->value('id'),
            'school_id' => $this->school->id,
            'scope_type' => 'student',
            'scope_id' => $student->id,
        ]);

        // The roster shows the login number to the staff.
        $rows = collect($this->getJson('/api/v1/students')->assertOk()->json('data'));
        $this->assertSame('09121112233', $rows->firstWhere('ulid', $student->ulid)['phone']);
    }

    public function test_persian_digits_are_normalized(): void
    {
        $this->postJson('/api/v1/students', [
            'student_code' => 'S1002',
            'first_name' => 'سارا',
            'last_name' => 'کریمی',
            'phone' => '۰۹۱۲۱۱۱۲۲۴۴',
        ])->assertCreated();

        $this->assertNotNull(User::query()->where('phone_hash', PhoneHash::of('09121112244'))->first());
    }

    public function test_an_existing_platform_account_is_linked_not_duplicated(): void
    {
        // E.g. a guardian who already self-registered with this number.
        $existing = User::factory()->create(['phone' => '09124440000']);
        $before = User::query()->count();

        $this->postJson('/api/v1/students', [
            'student_code' => 'S1003',
            'first_name' => 'رضا',
            'last_name' => 'مرادی',
            'phone' => '09124440000',
        ])->assertCreated();

        $this->assertSame($before, User::query()->count());
        $this->assertSame($existing->id, Student::query()->where('student_code', 'S1003')->firstOrFail()->user_id);
    }

    public function test_a_phone_already_bound_to_another_student_is_rejected(): void
    {
        $this->postJson('/api/v1/students', [
            'student_code' => 'S1004', 'first_name' => 'مینا', 'last_name' => 'نادری', 'phone' => '09125550000',
        ])->assertCreated();

        $this->postJson('/api/v1/students', [
            'student_code' => 'S1005', 'first_name' => 'علی', 'last_name' => 'کاظمی', 'phone' => '09125550000',
        ])->assertStatus(422)
            ->assertJsonPath('errors.phone.0', 'این شماره قبلاً به دانش‌آموز دیگری متصل شده است.');

        // No half-registered student may stay behind.
        $this->assertDatabaseMissing('students', ['student_code' => 'S1005']);
    }

    public function test_an_invalid_phone_is_rejected(): void
    {
        $this->postJson('/api/v1/students', [
            'student_code' => 'S1006', 'first_name' => 'بی‌شماره', 'last_name' => 'غلط', 'phone' => '12345',
        ])->assertStatus(422)
            ->assertJsonPath('errors.phone.0', 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود (مثال: 09121234567).');
    }

    public function test_csv_rows_with_a_phone_mint_accounts(): void
    {
        $csv = implode("\n", [
            'student_code,first_name,last_name,national_code,phone',
            'S2001,امیر,رضازاده,,09121112001',
            'S2002,سارا,موسوی,,۰۹۱۲۱۱۱۲۰۰۲',
            'S2003,شاگرد,بدشماره,,12345',
            'S2004,شاگرد,بی‌شماره,,',
        ]);
        $path = sys_get_temp_dir().'/students-'.uniqid().'.csv';
        file_put_contents($path, $csv);
        $file = new UploadedFile($path, 'students.csv', 'text/csv', null, true);

        $response = $this->postJson('/api/v1/imports/students', ['file' => $file])->assertCreated();
        $this->assertSame(3, $response->json('rows_ok'));

        $this->assertNotNull(User::query()->where('phone_hash', PhoneHash::of('09121112001'))->first());
        $this->assertNotNull(User::query()->where('phone_hash', PhoneHash::of('09121112002'))->first());
        $this->assertDatabaseMissing('students', ['student_code' => 'S2003']);
        $this->assertDatabaseHas('students', ['student_code' => 'S2004']);

        $batch = \App\Modules\Imports\Models\ImportBatch::query()->latest('id')->firstOrFail();
        $errors = collect($this->getJson("/api/v1/imports/{$batch->ulid}")->assertOk()->json('errors'));
        $this->assertStringContainsString('شماره موبایل', (string) $errors->firstWhere('row_number', 4)['message']);

        @unlink($path);
    }
}
