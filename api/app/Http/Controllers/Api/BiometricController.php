<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BiometricId;
use App\Models\BiometricPerson;
use App\Models\Employee;
use App\Services\Dtr\NameMatcher;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BiometricController extends Controller
{
    /** AC-Nos seen in imports that are not linked to a record, with a suggested match. */
    public function unlinked()
    {
        $taken = BiometricId::pluck('ac_no')->flip();
        $active = Employee::where('status', 'Active')->get(['id', 'employee_id', 'name']);
        $matcher = new NameMatcher($active->map(fn ($e) => ['id' => $e->id, 'employee_id' => $e->employee_id, 'name' => $e->name])->all());
        $rows = BiometricPerson::where('ignored', false)->get()->filter(fn ($p) => ! isset($taken[$p->ac_no]))->map(function ($p) use ($matcher) {
            $m = $matcher->match($p->name);
            $sug = $m['emp'] ?? (count($m['candidates']) === 1 ? $m['candidates'][0] : null);

            return [
                'ac_no' => $p->ac_no, 'name' => $p->name, 'department' => $p->department,
                'suggestion' => $sug ? ['id' => $sug['id'], 'employee_id' => $sug['employee_id'], 'name' => $sug['name'], 'level' => $m['level'] ?? 'medium'] : null,
                'candidates' => count($m['candidates']),
            ];
        })->sortBy([fn ($a, $b) => ($b['suggestion'] ? 1 : 0) <=> ($a['suggestion'] ? 1 : 0), fn ($a, $b) => ((int) $a['ac_no']) <=> ((int) $b['ac_no'])])->values();

        return response()->json(['data' => $rows]);
    }

    /** POST /biometric/link {links: [{ac_no, employee_id}]} */
    public function link(Request $request)
    {
        $data = $request->validate(['links' => 'required|array|min:1', 'links.*.ac_no' => 'required|string|max:20', 'links.*.employee_id' => 'required|integer|exists:employees,id']);
        $n = 0;
        DB::transaction(function () use ($data, &$n) {
            foreach ($data['links'] as $l) {
                $b = BiometricId::firstOrNew(['ac_no' => $l['ac_no']]);
                $b->employee_id = $l['employee_id'];
                $b->save();
                $emp = Employee::find($l['employee_id']);
                $bp = BiometricPerson::find($l['ac_no']);
                if ($bp?->department && ! in_array($emp->department_source, ['file', 'manual'], true)) {
                    $emp->update(['department' => $bp->department, 'department_source' => 'biometric']);
                }
                $n++;
            }
        });

        return response()->json(['linked' => $n]);
    }

    public function ignore(string $acNo)
    {
        $p = BiometricPerson::findOrFail($acNo);
        $p->update(['ignored' => true]);

        return response()->noContent();
    }
}
