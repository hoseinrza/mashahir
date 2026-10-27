<?php

namespace App\Support\Rbac;

/**
 * Typed access to the single-source permission matrix file.
 */
final class PermissionMatrix
{
    /** @var array<string, mixed>|null */
    private static ?array $cache = null;

    public static function load(): array
    {
        if (self::$cache === null) {
            self::$cache = require __DIR__.'/permission_matrix.php';
        }

        return self::$cache;
    }

    /** @return array<string, array{title: string, is_system: bool}> */
    public static function roles(): array
    {
        return self::load()['roles'];
    }

    /** @return array<string, string> */
    public static function conditions(): array
    {
        return self::load()['conditions'];
    }

    /** @return list<array{key: string, title: string, group: string}> */
    public static function permissions(): array
    {
        $permissions = [];

        foreach (self::load()['permissions'] as $group => $entries) {
            foreach ($entries as $entry) {
                $permissions[] = [
                    'key' => $entry['key'],
                    'title' => $entry['title'],
                    'group' => $group,
                ];
            }
        }

        return $permissions;
    }

    /** @return array<string, string> permission key => title */
    public static function permissionTitles(): array
    {
        return collect(self::permissions())
            ->pluck('title', 'key')
            ->all();
    }

    /**
     * The raw matrix: permission key => role key => true | 'shN' | ['shN', ...].
     *
     * @return array<string, array<string, mixed>>
     */
    public static function matrix(): array
    {
        return self::load()['matrix'];
    }

    /**
     * Grants for one permission: role key => true | 'shN' | ['shN', ...].
     * Roles missing from the map are denied (default deny).
     *
     * @return array<string, mixed>
     */
    public static function grantsFor(string $permissionKey): array
    {
        return self::matrix()[$permissionKey] ?? [];
    }
}
