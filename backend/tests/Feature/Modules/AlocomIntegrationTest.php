<?php

namespace Tests\Feature\Modules;

use App\Modules\Academic\Models\ClassroomSubject;
use App\Modules\OnlineClasses\Models\OnlineClass;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

class AlocomIntegrationTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();
        config(['alocom.driver' => 'fake']);
    }

    private function makeClassroomSubject(): ClassroomSubject
    {
        return ClassroomSubject::query()->create([
            'classroom_id' => $this->makeClassroom()->id,
            'subject_id' => $this->makeSubject()->id,
        ]);
    }

    private function storeAlocomCredentials(): void
    {
        $this->putJson('/api/v1/school/settings', ['settings' => [
            ['key' => 'alocom_credentials', 'value' => ['username' => 'mashahir', 'password' => 'secret123']],
        ]])->assertOk();
    }

    public function test_school_admin_stores_and_verifies_alocom_credentials(): void
    {
        $this->actingWithRole('school_admin');

        // The credentials are verified LIVE against the provider (fake here)
        // before anything is stored.
        $this->storeAlocomCredentials();

        $this->assertTrue($this->school->fresh()->alocomConfigured());
        // The password never lands in plaintext.
        $this->assertDatabaseMissing('schools', ['alocom_password' => 'secret123']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'school.alocom_credentials_set']);

        // Read side: only the username and a flag, never the password.
        $this->getJson('/api/v1/school/settings')->assertOk()
            ->assertJsonPath('alocom_configured', true)
            ->assertJsonPath('alocom_username', 'mashahir')
            ->assertJsonMissing(['alocom_password' => 'secret123']);
    }

    public function test_wrong_alocom_password_is_rejected_and_not_saved(): void
    {
        $this->actingWithRole('school_admin');

        $this->putJson('/api/v1/school/settings', ['settings' => [
            ['key' => 'alocom_credentials', 'value' => ['username' => 'mashahir', 'password' => 'bad']],
        ]])->assertStatus(422)
            ->assertJsonPath('errors.settings.0', 'اتصال به الوکام برقرار نشد: نام کاربری یا رمز الوکام نادرست است.');

        $this->assertFalse($this->school->fresh()->alocomConfigured());
    }

    public function test_empty_payload_disconnects_alocom(): void
    {
        $this->actingWithRole('school_admin');
        $this->storeAlocomCredentials();

        $this->putJson('/api/v1/school/settings', ['settings' => [
            ['key' => 'alocom_credentials', 'value' => ['username' => '', 'password' => '']],
        ]])->assertOk();

        $this->assertFalse($this->school->fresh()->alocomConfigured());
        $this->assertDatabaseHas('audit_logs', ['action' => 'school.alocom_credentials_cleared']);
    }

    public function test_teacher_cannot_touch_school_settings(): void
    {
        $this->actingWithRole('teacher');

        $this->putJson('/api/v1/school/settings', ['settings' => [
            ['key' => 'alocom_credentials', 'value' => ['username' => 'x', 'password' => 'y']],
        ]])->assertForbidden();
    }

    public function test_class_on_alocam_provider_needs_school_credentials(): void
    {
        $this->actingWithRole('school_admin');
        $cs = $this->makeClassroomSubject();

        $this->postJson('/api/v1/online-classes', [
            'classroom_subject_id' => $cs->id, 'title' => 'کلاس الوکام', 'provider' => 'alocom',
        ])->assertStatus(422);

        $this->storeAlocomCredentials();

        $response = $this->postJson('/api/v1/online-classes', [
            'classroom_subject_id' => $cs->id, 'title' => 'کلاس الوکام', 'provider' => 'alocom',
        ])->assertCreated();

        $this->assertSame('alocom', $response->json('provider'));

        $class = OnlineClass::query()->latest('id')->firstOrFail();
        $this->assertSame('alocom', $class->provider);
        $this->assertNotNull($class->alocom_event_id);
        $this->assertStringStartsWith('https://demo.alocom.local/event/', (string) $class->alocom_link);
    }

    public function test_entering_an_alocam_class_returns_the_user_event_link(): void
    {
        $this->actingWithRole('school_admin');
        $this->storeAlocomCredentials();

        $cs = $this->makeClassroomSubject();
        $this->postJson('/api/v1/online-classes', [
            'classroom_subject_id' => $cs->id, 'title' => 'کلاس الوکام', 'provider' => 'alocom',
        ])->assertCreated();

        $class = OnlineClass::query()->latest('id')->firstOrFail();

        // School staff enters as an Alocom assistant; students would enter as
        // participants — the link carries their real names, no Alocom account.
        $this->getJson("/api/v1/online-classes/{$class->ulid}/enter")->assertOk()
            ->assertJsonPath('url', function ($url): bool {
                return str_contains($url, '/entry/u') && str_contains($url, '/assistant');
            });

        // The personnel list flags Alocom as ready for the class form.
        $this->getJson('/api/v1/online-classes')->assertOk()
            ->assertJsonPath('alocom_ready', true);
    }

    public function test_default_provider_stays_skyroom(): void
    {
        $this->actingWithRole('school_admin');
        $cs = $this->makeClassroomSubject();

        $this->postJson('/api/v1/online-classes', [
            'classroom_subject_id' => $cs->id, 'title' => 'کلاس اسکای‌روم',
        ])->assertCreated();

        $this->assertSame('skyroom', OnlineClass::query()->latest('id')->firstOrFail()->provider);
    }
}
