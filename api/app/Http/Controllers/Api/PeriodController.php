<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Period;
use App\Services\Dtr\DtrService;
use Illuminate\Http\Request;

class PeriodController extends Controller
{
    public function index()
    {
        return response()->json(['data' => Period::with('importer')->orderByDesc('period')->get()->map->toApi()->values()]);
    }

    public function dtr(Request $request, string $period)
    {
        $p = Period::where('period', $period)->firstOrFail();
        $data = $request->validate(['from' => 'nullable|date_format:Y-m-d', 'to' => 'nullable|date_format:Y-m-d|after_or_equal:from']);

        return response()->json(DtrService::forPeriod($p, $data['from'] ?? null, $data['to'] ?? null));
    }

    public function destroy(string $period)
    {
        Period::where('period', $period)->firstOrFail()->delete();

        return response()->noContent();
    }
}
