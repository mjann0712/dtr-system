<?php

namespace App\Models;

use App\Services\Dtr\DtrCalculator;
use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $fillable = ['key', 'value'];

    protected $casts = ['value' => 'array'];

    /** DTR rules merged over the defaults. */
    public static function dtr(): array
    {
        $row = static::where('key', 'dtr')->first();

        return array_replace(DtrCalculator::defaults(), $row?->value ?? []);
    }

    public static function saveDtr(array $value): array
    {
        $clean = array_intersect_key($value, DtrCalculator::defaults());
        static::updateOrCreate(['key' => 'dtr'], ['value' => $clean]);

        return static::dtr();
    }
}
