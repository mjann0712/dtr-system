<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    public function show()
    {
        return response()->json(Setting::dtr());
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'sched' => 'required|array', 'sched.amIn' => 'required|date_format:H:i', 'sched.amOut' => 'required|date_format:H:i',
            'sched.pmIn' => 'required|date_format:H:i', 'sched.pmOut' => 'required|date_format:H:i',
            'workDays' => 'present|array', 'workDays.*' => 'integer|between:0,6',
            'holidays' => 'present|array', 'holidays.*.date' => 'required|date_format:Y-m-d', 'holidays.*.label' => 'nullable|string|max:40',
            'deptSched' => 'present|array', 'institutions' => 'present|array',
            'grace' => 'required|integer|min:0|max:120', 'dedupe' => 'required|integer|min:0|max:60',
            'ignoreInvalid' => 'boolean', 'lunchRule' => 'boolean', 'capToSched' => 'boolean', 'includeNoPunch' => 'boolean', 'compact' => 'boolean',
            'meta' => 'present|array',
        ]);
        $data['holidays'] = collect($data['holidays'])->map(fn ($h) => ['date' => $h['date'], 'label' => strtoupper($h['label'] ?? '') ?: 'HOLIDAY'])->sortBy('date')->values()->all();

        return response()->json(Setting::saveDtr($data));
    }
}
