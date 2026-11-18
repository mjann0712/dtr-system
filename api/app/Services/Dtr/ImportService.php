<?php

namespace App\Services\Dtr;

use App\Models\BiometricId;
use App\Models\BiometricPerson;
use App\Models\Employee;
use App\Models\Period;
use App\Models\Punch;
use Illuminate\Support\Facades\DB;

class ImportService
{
    /**
     * @param  array<int, array{name: string, rows: array}>  $sheets
     * @return array{status: string, period?: string, notes: string[], found: array}
     */
    public function import(array $sheets, string $fileNames, bool $replace, ?int $userId): array
    {
        $notes = [];

        // 1) employee records file
        $er = EmployeeFileReader::read($sheets);
        if ($er && count($er['employees']) >= 3) {
            [$added, $updated] = $this->importEmployees($er['employees']);
            $notes[] = "{$added} employee records added, {$updated} updated";
        }

        // 2) time-clock data and biometric list
        $d = TimeClockReader::read($sheets);
        $bio = array_values(array_map(fn ($e) => ['ac' => $e['ac'], 'name' => $e['name'], 'dept' => $e['dept']], $d['employees']));
        $seen = [];
        foreach ($d['punches'] as $p) {
            $seen[$p['ac']] ??= ['ac' => $p['ac'], 'name' => $p['name'], 'dept' => null];
        }
        $entries = array_merge($bio, array_values($seen));

        if (! $d['punches'] && ! $entries && ! $er) {
            return ['status' => 'empty', 'notes' => [], 'found' => $d['found']];
        }

        $period = null;
        if ($d['punches']) {
            $per = DtrCalculator::guessPeriod($d['punches']);
            $period = $per['period'];
            if (! $replace && Period::where('period', $period)->exists()) {
                return ['status' => 'exists', 'period' => $period, 'notes' => $notes, 'found' => $d['found']];
            }
            $count = $this->savePeriod($per, $d['punches'], $fileNames, $userId);
            array_unshift($notes, "{$per['from']} to {$per['to']} saved ({$count} punches)");
        }

        $this->rememberBiometric($entries);
        $linked = $this->autoLink($entries);
        if ($linked) {
            $notes[] = "{$linked} biometric IDs linked by name";
        }

        return ['status' => 'ok', 'period' => $period, 'notes' => $notes, 'found' => $d['found']];
    }

    /** @return array{0:int,1:int} added, updated */
    public function importEmployees(array $rows): array
    {
        $added = 0;
        $updated = 0;
        DB::transaction(function () use ($rows, &$added, &$updated) {
            $existing = Employee::all()->keyBy('employee_id');
            foreach ($rows as $n) {
                $acNos = $n['ac_nos'];
                unset($n['ac_nos']);
                $o = $existing[$n['employee_id']] ?? null;
                if (! $o) {
                    $o = Employee::create($n);
                    $added++;
                } else {
                    // keep a department HR set by hand or from the biometric list
                    $keepDept = in_array($o->department_source, ['manual', 'biometric'], true) && $n['department_source'] !== 'file';
                    if ($keepDept || ! $n['department']) {
                        unset($n['department'], $n['department_source']);
                    }
                    $o->update($n);
                    $updated++;
                }
                foreach ($acNos as $ac) {
                    BiometricId::firstOrCreate(['ac_no' => (string) $ac], ['employee_id' => $o->id]);
                }
            }
        });

        return [$added, $updated];
    }

    private function savePeriod(array $per, array $punches, string $fileNames, ?int $userId): int
    {
        $rows = array_values(array_filter($punches, fn ($p) => str_starts_with($p['date'], $per['period'])));

        return DB::transaction(function () use ($per, $rows, $fileNames, $userId) {
            $old = Period::where('period', $per['period'])->first();
            if ($old) {
                $old->punches()->delete();
            }
            $people = count(array_unique(array_column($rows, 'ac')));
            $period = Period::updateOrCreate(['period' => $per['period']], [
                'date_from' => $per['from'], 'date_to' => $per['to'], 'file_name' => mb_substr($fileNames, 0, 255),
                'people' => $people, 'punch_count' => count($rows), 'imported_by' => $userId,
            ]);
            $period->touch();
            foreach (array_chunk($rows, 1000) as $chunk) {
                Punch::insert(array_map(fn ($p) => [
                    'period_id' => $period->id, 'ac_no' => mb_substr((string) $p['ac'], 0, 20), 'name' => mb_substr($p['name'], 0, 160),
                    'punch_date' => $p['date'], 'minute' => $p['min'],
                    'state' => mb_substr($p['state'] ?? '', 0, 30) ?: null, 'exception' => mb_substr($p['exc'] ?? '', 0, 30) ?: null,
                ], $chunk));
            }

            return count($rows);
        });
    }

    private function rememberBiometric(array $entries): void
    {
        foreach ($entries as $e) {
            $p = BiometricPerson::find((string) $e['ac']) ?? new BiometricPerson(['ac_no' => (string) $e['ac']]);
            if ($e['name']) {
                $p->name = mb_substr($e['name'], 0, 160);
            }
            if (! empty($e['dept']) && $e['dept'] !== 'UNASSIGNED') {
                $p->department = $e['dept'];
            }
            $p->save();
        }
    }

    /** Link AC-Nos to records when the name matches with high confidence. */
    public function autoLink(array $entries): int
    {
        $taken = BiometricId::with('employee')->get()->keyBy('ac_no');
        $active = Employee::where('status', 'Active')->get();
        $matcher = new NameMatcher($active->map(fn ($e) => ['id' => $e->id, 'name' => $e->name])->all());
        $byId = $active->keyBy('id');
        $ignored = BiometricPerson::where('ignored', true)->pluck('ac_no')->flip();
        $n = 0;
        foreach ($entries as $en) {
            $ac = (string) $en['ac'];
            $dept = $en['dept'] ?? null;
            if ($cur = $taken[$ac] ?? null) {
                $emp = $cur->employee;
                if ($dept && $dept !== 'UNASSIGNED' && ! in_array($emp->department_source, ['file', 'manual', 'biometric'], true)) {
                    $emp->update(['department' => $dept, 'department_source' => 'biometric']);
                }

                continue;
            }
            if (isset($ignored[$ac])) {
                continue;
            }
            $m = $matcher->match($en['name']);
            if ($m['level'] !== 'high') {
                continue;
            }
            $emp = $byId[$m['emp']['id']];
            $taken[$ac] = BiometricId::create(['ac_no' => $ac, 'employee_id' => $emp->id])->setRelation('employee', $emp);
            if ($dept && $dept !== 'UNASSIGNED' && ! in_array($emp->department_source, ['file', 'manual'], true)) {
                $emp->update(['department' => $dept, 'department_source' => 'biometric']);
            }
            $n++;
        }

        return $n;
    }
}
