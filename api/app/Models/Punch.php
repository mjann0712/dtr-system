<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Punch extends Model
{
    public $timestamps = false;

    protected $fillable = ['period_id', 'ac_no', 'name', 'punch_date', 'minute', 'state', 'exception'];
}
