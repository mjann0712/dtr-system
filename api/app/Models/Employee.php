<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Employee extends Model
{
    protected $fillable = ['employee_id', 'last_name', 'first_name', 'name', 'position', 'department', 'department_source', 'gender', 'date_hired', 'status'];

    protected $casts = ['date_hired' => 'date:Y-m-d'];

    public function biometricIds(): HasMany
    {
        return $this->hasMany(BiometricId::class);
    }

    public function toApi(): array
    {
        return [
            'id' => $this->id,
            'employee_id' => $this->employee_id,
            'last_name' => $this->last_name,
            'first_name' => $this->first_name,
            'name' => $this->name,
            'position' => $this->position,
            'department' => $this->department,
            'department_source' => $this->department_source,
            'gender' => $this->gender,
            'date_hired' => $this->date_hired?->format('Y-m-d'),
            'status' => $this->status,
            'ac_nos' => $this->biometricIds->pluck('ac_no')->values()->all(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
