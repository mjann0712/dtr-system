<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BiometricPerson extends Model
{
    protected $table = 'biometric_people';

    protected $primaryKey = 'ac_no';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['ac_no', 'name', 'department', 'ignored'];

    protected $casts = ['ignored' => 'boolean'];
}
