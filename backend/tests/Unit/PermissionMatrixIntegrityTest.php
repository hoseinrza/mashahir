<?php

namespace Tests\Unit;

use App\Support\Rbac\PermissionMatrix;
use PHPUnit\Framework\TestCase;

/**
 * Guards the single-source matrix file itself: a typo here would silently
 * deny or leak permissions everywhere, so the file must be self-consistent.
 */
class PermissionMatrixIntegrityTest extends TestCase
{
    public function test_matrix_is_non_empty_and_wellformed(): void
    {
        $data = PermissionMatrix::load();

        $this->assertNotEmpty($data['roles']);
        $this->assertNotEmpty($data['permissions']);
        $this->assertNotEmpty($data['conditions']);
    }

    public function test_every_granted_role_is_declared(): void
    {
        $roles = PermissionMatrix::roles();

        foreach (PermissionMatrix::matrix() as $permissionKey => $grants) {
            foreach ($grants as $roleKey => $value) {
                $this->assertArrayHasKey(
                    $roleKey,
                    $roles,
                    "Matrix grants {$permissionKey} to undeclared role [{$roleKey}].",
                );
            }
        }
    }

    public function test_every_matrix_permission_is_declared(): void
    {
        $declared = array_column(PermissionMatrix::permissions(), 'key');

        foreach (array_keys(PermissionMatrix::matrix()) as $permissionKey) {
            $this->assertContains(
                $permissionKey,
                $declared,
                "Matrix references undeclared permission [{$permissionKey}].",
            );
        }
    }

    public function test_every_declared_permission_appears_in_matrix(): void
    {
        $matrixKeys = array_keys(PermissionMatrix::matrix());

        foreach (PermissionMatrix::permissions() as $permission) {
            $this->assertContains(
                $permission['key'],
                $matrixKeys,
                "Permission [{$permission['key']}] is declared but has no matrix entry.",
            );
        }
    }

    public function test_condition_codes_are_defined(): void
    {
        $conditions = array_keys(PermissionMatrix::conditions());

        foreach (PermissionMatrix::matrix() as $permissionKey => $grants) {
            foreach ($grants as $value) {
                if ($value === true) {
                    continue;
                }

                foreach ((array) $value as $code) {
                    $this->assertIsString($code);
                    $this->assertMatchesRegularExpression('/^sh\d+$/', $code);
                    $this->assertContains(
                        $code,
                        $conditions,
                        "Matrix uses undefined condition [{$code}] for {$permissionKey}.",
                    );
                }
            }
        }
    }

    public function test_cells_are_true_condition_or_list(): void
    {
        foreach (PermissionMatrix::matrix() as $permissionKey => $grants) {
            foreach ($grants as $roleKey => $value) {
                $valid = $value === true
                    || is_string($value)
                    || (is_array($value) && $value !== []);

                $this->assertTrue(
                    $valid,
                    "Matrix cell [{$permissionKey}][{$roleKey}] has an invalid value.",
                );
            }
        }
    }

    public function test_switch_role_is_granted_to_every_role(): void
    {
        $grants = PermissionMatrix::grantsFor('auth.switch_role');

        $this->assertSame(
            array_keys(PermissionMatrix::roles()),
            array_keys($grants),
            'auth.switch_role must be granted to every declared role.',
        );
    }
}
