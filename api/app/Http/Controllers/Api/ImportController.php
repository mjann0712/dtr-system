<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Dtr\ImportService;
use App\Services\Dtr\SheetLoader;
use Illuminate\Http\Request;

class ImportController extends Controller
{
    /** POST /import  files[] (xls, xlsx, csv), replace=0|1 */
    public function store(Request $request, ImportService $service)
    {
        $request->validate([
            'files' => 'required|array|min:1|max:5',
            'files.*' => 'file|max:20480|extensions:xls,xlsx,csv,txt',
            'replace' => 'nullable|boolean',
        ]);
        @set_time_limit(300);
        ini_set('memory_limit', '1024M');

        $sheets = [];
        $names = [];
        foreach ($request->file('files') as $f) {
            $names[] = $f->getClientOriginalName();
            try {
                array_push($sheets, ...SheetLoader::load($f->getRealPath(), $f->getClientOriginalName()));
            } catch (\Throwable $e) {
                return response()->json(['message' => "{$f->getClientOriginalName()} could not be read. Save it as .xlsx or .csv and try again."], 422);
            }
        }
        $res = $service->import($sheets, implode(', ', $names), $request->boolean('replace'), $request->user()?->id);

        return match ($res['status']) {
            'exists' => response()->json(['message' => "{$res['period']} is already saved. Send replace=1 to replace it.", 'period' => $res['period'], 'needsReplace' => true], 409),
            'empty' => response()->json(['message' => 'Nothing to import was found. Upload the time-clock export (AC-No., Name, Time), the daily summary (AC-No., Date, Clock In 1 …) or the employee records file (EMPLOYEE ID, name, position).'], 422),
            default => response()->json($res),
        };
    }
}
