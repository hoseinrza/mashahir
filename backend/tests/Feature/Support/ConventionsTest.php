<?php

namespace Tests\Feature\Support;

use App\Support\AppendOnlyViolationException;
use App\Support\Concerns\AppendOnly;
use App\Support\Concerns\BelongsToSchool;
use App\Support\Concerns\HasUlid;
use App\Support\SchoolContext;
use App\Support\SchoolContextMissingException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ConventionsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('convention_things');
        Schema::create('convention_things', function (Blueprint $table): void {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->unsignedBigInteger('school_id');
            $table->string('name');
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('convention_things');
        app(SchoolContext::class)->forget();

        parent::tearDown();
    }

    private function scopedModel(): Model
    {
        return new class extends Model
        {
            use BelongsToSchool;
            use HasUlid;

            protected $table = 'convention_things';
            protected $guarded = [];
        };
    }

    private function appendOnlyModel(): Model
    {
        return new class extends Model
        {
            use AppendOnly;

            protected $table = 'convention_things';
            protected $guarded = [];
        };
    }

    public function test_create_fills_school_id_and_generates_ulid(): void
    {
        app(SchoolContext::class)->set(1);

        $row = $this->scopedModel()::create(['name' => 'a']);

        $this->assertSame(1, $row->school_id);
        $this->assertNotEmpty($row->ulid);
        $this->assertSame('ulid', $row->getRouteKeyName());
        $this->assertSame($row->ulid, $row->getRouteKey());
    }

    public function test_scope_returns_only_rows_of_the_active_school(): void
    {
        app(SchoolContext::class)->override();
        $this->scopedModel()::create(['name' => 'a', 'school_id' => 1]);
        $this->scopedModel()::create(['name' => 'b', 'school_id' => 2]);

        app(SchoolContext::class)->forget();
        app(SchoolContext::class)->set(1);

        $rows = $this->scopedModel()::all();

        $this->assertCount(1, $rows);
        $this->assertSame('a', $rows[0]->name);
        $this->assertSame(1, $rows[0]->school_id);
    }

    public function test_query_without_school_context_fails_loudly(): void
    {
        app(SchoolContext::class)->override();
        $this->scopedModel()::create(['name' => 'a', 'school_id' => 1]);

        app(SchoolContext::class)->forget();

        $this->expectException(SchoolContextMissingException::class);
        $this->scopedModel()::all();
    }

    public function test_explicit_override_bypasses_the_scope(): void
    {
        app(SchoolContext::class)->override();
        $this->scopedModel()::create(['name' => 'a', 'school_id' => 1]);
        $this->scopedModel()::create(['name' => 'b', 'school_id' => 2]);

        $this->assertCount(2, $this->scopedModel()::all());
    }

    public function test_create_does_not_overwrite_an_explicit_school_id(): void
    {
        app(SchoolContext::class)->set(1);

        $row = $this->scopedModel()::create(['name' => 'a', 'school_id' => 99]);

        $this->assertSame(99, $row->school_id);
    }

    public function test_append_only_model_rejects_update_and_delete(): void
    {
        $id = DB::table('convention_things')->insertGetId([
            'ulid' => '01J00000000000000000000000',
            'school_id' => 1,
            'name' => 'history',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $row = $this->appendOnlyModel()::query()->withoutGlobalScopes()->findOrFail($id);

        $row->name = 'tampered';

        $this->expectException(AppendOnlyViolationException::class);
        $row->save();
    }

    public function test_append_only_model_rejects_delete(): void
    {
        $id = DB::table('convention_things')->insertGetId([
            'ulid' => '01J00000000000000000000000',
            'school_id' => 1,
            'name' => 'history',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $row = $this->appendOnlyModel()::query()->withoutGlobalScopes()->findOrFail($id);

        $this->expectException(AppendOnlyViolationException::class);
        $row->delete();
    }
}
