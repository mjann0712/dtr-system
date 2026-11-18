<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BiometricId;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class EmployeeController extends Controller
{
    public function index(Request $request)
    {
        $q = Employee::with('biometricIds')->orderBy('name');
        if ($s = trim((string) $request->query('q'))) {
            $q->where(function ($w) use ($s) {
                $w->where('name', 'like', "%{$s}%")->orWhere('employee_id', 'like', "%{$s}%")->orWhere('position', 'like', "%{$s}%")
                    ->orWhereHas('biometricIds', fn ($b) => $b->where('ac_no', $s));
            });
        }
        match ($request->query('show')) {
            'active' => $q->where('status', 'Active'),
            'inactive' => $q->where('status', 'Inactive'),
            'unlinked' => $q->doesntHave('biometricIds'),
            'nodept' => $q->where(fn ($w) => $w->whereNull('department')->orWhere('department', '')),
            default => null,
        };
        if ($d = $request->query('department')) {
            $q->where('department', $d);
        }
        $list = $q->get();

        return response()->json([
            'data' => $list->map->toApi()->values(),
            'counts' => [
                'total' => Employee::count(),
                'active' => Employee::where('status', 'Active')->count(),
                'inactive' => Employee::where('status', 'Inactive')->count(),
                'linked' => Employee::has('biometricIds')->count(),
                'nodept' => Employee::where(fn ($w) => $w->whereNull('department')->orWhere('department', ''))->count(),
            ],
            'departments' => Employee::whereNotNull('department')->where('department', '<>', '')->distinct()->orderBy('department')->pluck('department'),
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $emp = DB::transaction(function () use ($data) {
            $emp = Employee::create($this->fields($data, null));
            $this->syncAcs($emp, $data['ac_nos'] ?? []);

            return $emp;
        });

        return response()->json($emp->load('biometricIds')->toApi(), 201);
    }

    public function update(Request $request, Employee $employee)
    {
        $data = $this->validated($request, $employee);
        DB::transaction(function () use ($data, $employee) {
            $employee->update($this->fields($data, $employee));
            $this->syncAcs($employee, $data['ac_nos'] ?? []);
        });

        return response()->json($employee->fresh('biometricIds')->toApi());
    }

    public function destroy(Employee $employee)
    {
        $employee->delete();

        return response()->noContent();
    }

    /** POST /employees/status {ids: [..], status: Active|Inactive} */
    public function status(Request $request)
    {
        $data = $request->validate(['ids' => 'required|array|min:1', 'ids.*' => 'integer', 'status' => ['required', Rule::in(['Active', 'Inactive'])]]);
        $n = Employee::whereIn('id', $data['ids'])->where('status', '<>', $data['status'])->update(['status' => $data['status']]);

        return response()->json(['updated' => $n]);
    }

    private function validated(Request $request, ?Employee $emp = null): array
    {
        return $request->validate([
            'employee_id' => ['required', 'string', 'max:40', Rule::unique('employees', 'employee_id')->ignore($emp?->id)],
            'last_name' => 'required|string|max:80',
            'first_name' => 'nullable|string|max:120',
            'position' => 'nullable|string|max:160',
            'department' => 'nullable|string|max:40',
            'gender' => 'nullable|string|max:10',
            'date_hired' => 'nullable|date_format:Y-m-d',
            'status' => ['required', Rule::in(['Active', 'Inactive'])],
            'ac_nos' => 'array', 'ac_nos.*' => 'string|max:20',
        ]);
    }

    private function fields(array $d, ?Employee $emp): array
    {
        $last = mb_strtoupper(trim($d['last_name']));
        $first = mb_strtoupper(trim($d['first_name'] ?? ''));
        $dept = mb_strtoupper(trim($d['department'] ?? '')) ?: null;
        $deptChanged = ! $emp || $emp->department !== $dept;

        return [
            'employee_id' => mb_strtoupper(trim($d['employee_id'])), 'last_name' => $last, 'first_name' => $first,
            'name' => $first !== '' ? "{$last}, {$first}" : $last, 'position' => trim($d['position'] ?? ''),
            'department' => $dept, 'department_source' => $deptChanged ? ($dept ? 'manual' : null) : $emp->department_source,
            'gender' => $d['gender'] ?? null, 'date_hired' => $d['date_hired'] ?? null, 'status' => $d['status'],
        ];
    }

    private function syncAcs(Employee $emp, array $acs): void
    {
        $acs = array_values(array_unique(array_filter(array_map(fn ($a) => trim((string) $a), $acs))));
        $clash = BiometricId::with('employee')->whereIn('ac_no', $acs)->where('employee_id', '<>', $emp->id)->first();
        if ($clash) {
            throw ValidationException::withMessages(['ac_nos' => "AC-No. {$clash->ac_no} is already linked to {$clash->employee->name} — remove it there first."]);
        }
        $emp->biometricIds()->whereNotIn('ac_no', $acs ?: ['__none__'])->delete();
        foreach ($acs as $ac) {
            BiometricId::firstOrCreate(['ac_no' => $ac], ['employee_id' => $emp->id]);
        }
    }
}
