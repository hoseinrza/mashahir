<?php

namespace App\Support;

/**
 * Holds the active school for the current request (or test).
 *
 * Set once by the auth-context middleware; read by the BelongsToSchool
 * global scope. No school context means a school-scoped query must fail
 * loudly, never silently return cross-school rows.
 */
final class SchoolContext
{
    private ?int $schoolId = null;

    private bool $overridden = false;

    public function set(int $schoolId): void
    {
        $this->schoolId = $schoolId;
        $this->overridden = false;
    }

    /**
     * Escape hatch for school-agnostic operations (seeders, platform-level
     * tooling). The scope must never be bypassed implicitly.
     */
    public function override(): void
    {
        $this->overridden = true;
    }

    public function forget(): void
    {
        $this->schoolId = null;
        $this->overridden = false;
    }

    public function schoolId(): ?int
    {
        return $this->schoolId;
    }

    public function hasOverride(): bool
    {
        return $this->overridden;
    }
}
