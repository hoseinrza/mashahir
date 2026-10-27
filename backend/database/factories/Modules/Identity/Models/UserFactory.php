<?php

namespace Database\Factories\Modules\Identity\Models;

use App\Modules\Identity\Models\User;
use App\Support\PhoneHash;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected $model = User::class;

    public function definition(): array
    {
        return [
            'first_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
            'phone' => '0912'.fake()->numerify('#######'),
            'status' => 'active',
        ];
    }

    public function configure(): static
    {
        return $this->afterMaking(function (User $user): void {
            $user->phone_hash ??= PhoneHash::of($user->phone);
        })->afterCreating(function (User $user): void {
            if ($user->phone_hash === null) {
                $user->forceFill(['phone_hash' => PhoneHash::of($user->phone)])->saveQuietly();
            }
        });
    }

    public function blocked(): static
    {
        return $this->state(fn () => ['status' => 'blocked']);
    }
}
