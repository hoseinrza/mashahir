<?php

namespace Tests\Feature\Modules;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\Models\UserRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

/**
 * سرویس مدرسه: ساخت خط و ایستگاه، تخصیص دانش‌آموز و ثبت سوارشدن توسط راننده.
 */
class TransportFlowTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();
    }

    public function test_office_manager_builds_a_route_with_stops_and_assigns_a_student(): void
    {
        $this->actingWithRole('office_manager');

        $route = $this->postJson('/api/v1/transport/routes', [
            'code' => 'خط ۳',
            'title' => 'مسیر شمال — تجریش',
            'capacity' => 14,
        ])->assertCreated()->json();

        $this->assertSame('خط ۳', $route['code']);

        $stop = $this->postJson("/api/v1/transport/routes/{$route['ulid']}/stops", [
            'title' => 'میدان تجریش',
            'pickup_time' => '07:10',
        ])->assertCreated()->json();

        $student = $this->makeStudent();

        $this->postJson("/api/v1/transport/routes/{$route['ulid']}/students", [
            'student_ulid' => $student->ulid,
            'bus_stop_ulid' => $stop['ulid'],
        ])->assertCreated();

        $rows = $this->getJson('/api/v1/transport/routes')->assertOk()->json('data');

        $this->assertCount(1, $rows);
        $this->assertSame(1, $rows[0]['students_count']);
        $this->assertCount(1, $rows[0]['stops']);
        $this->assertSame('میدان تجریش', $rows[0]['stops'][0]['title']);
    }

    public function test_a_driver_sees_only_his_route_and_can_mark_boarding(): void
    {
        $this->actingWithRole('office_manager');

        $driver = $this->makeUser();

        $route = $this->postJson('/api/v1/transport/routes', [
            'code' => 'خط ۱',
            'title' => 'مسیر مرکز',
            'driver_ulid' => $driver->ulid,
        ])->assertCreated()->json();

        $other = $this->postJson('/api/v1/transport/routes', [
            'code' => 'خط ۲',
            'title' => 'مسیر شرق',
        ])->assertCreated()->json();

        $student = $this->makeStudent();
        $this->postJson("/api/v1/transport/routes/{$route['ulid']}/students", [
            'student_ulid' => $student->ulid,
        ])->assertCreated();

        $this->actingAsBusDriver($driver);

        $mine = $this->getJson('/api/v1/transport/my-route')->assertOk()->json();

        $this->assertSame($route['ulid'], $mine['route']['ulid']);
        $this->assertCount(1, $mine['roster']);
        $this->assertSame($student->ulid, $mine['roster'][0]['student_ulid']);

        $this->postJson('/api/v1/transport/boardings', [
            'route_ulid' => $route['ulid'],
            'student_ulid' => $student->ulid,
            'direction' => 'in',
            'status' => 'boarded',
        ])->assertOk()->assertJsonPath('status', 'boarded');

        // Another route is not his to touch.
        $this->postJson('/api/v1/transport/boardings', [
            'route_ulid' => $other['ulid'],
            'student_ulid' => $student->ulid,
            'direction' => 'in',
            'status' => 'boarded',
        ])->assertForbidden();
    }

    public function test_a_teacher_has_no_transport_access(): void
    {
        $this->actingWithRole('teacher');

        $this->getJson('/api/v1/transport/routes')->assertForbidden();
    }

    /** رانندهٔ سرویس نقش سیستمی نیست؛ مدرسه یک نقش سفارشی با transport.board می‌سازد. */
    private function actingAsBusDriver(User $driver): void
    {
        $roleId = \DB::table('roles')->insertGetId([
            'school_id' => $this->school->id,
            'key' => 'bus_driver',
            'title' => 'راننده سرویس',
            'is_system' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $permissionId = \DB::table('permissions')->where('key', 'transport.board')->value('id');

        \DB::table('role_permissions')->insert([
            'role_id' => $roleId,
            'permission_id' => $permissionId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $assignment = UserRole::query()->create([
            'user_id' => $driver->id,
            'role_id' => $roleId,
            'school_id' => $this->school->id,
            'scope_type' => 'school',
            'scope_id' => null,
        ]);

        $this->app['auth']->forgetGuards();
        $token = $driver->createToken('test', ["role:{$assignment->id}"])->plainTextToken;
        $this->withToken($token);
    }
}
