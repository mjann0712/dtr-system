<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Period extends Model
{
    protected $fillable = ['period', 'date_from', 'date_to', 'file_name', 'people', 'punch_count', 'imported_by'];

    protected $casts = ['date_from' => 'date:Y-m-d', 'date_to' => 'date:Y-m-d'];

    public function punches(): HasMany
    {
        return $this->hasMany(Punch::class);
    }

    public function importer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'imported_by');
    }

    public function toApi(): array
    {
        return [
            'period' => $this->period,
            'from' => $this->date_from->format('Y-m-d'),
            'to' => $this->date_to->format('Y-m-d'),
            'file' => $this->file_name,
            'people' => $this->people,
            'punches' => $this->punch_count,
            'imported_at' => $this->updated_at?->toIso8601String(),
            'imported_by' => $this->importer?->name,
        ];
    }
}
