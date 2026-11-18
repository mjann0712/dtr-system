<?php

namespace App\Services\Dtr;

use App\Models\BiometricId;
use App\Models\Period;
use App\Models\Setting;

class DtrService
{
    /** AC-No. -> employee info for the calculator */
    public static function employeeMap(): array
    {
        $map = [];
        foreach (BiometricId::with('employee')->get() as $b) {
            $e = $b->employee;
            $map[(string) $b->ac_no] = [
                'ac' => (string) $b->ac_no, 'name' => $e->name, 'dept' => $e->department ?: 'UNASSIGNED', 'inst' => '',
                'empId' => $e->employee_id, 'position' => $e->position, 'status' => $e->status, 'amIn' => null, 'pmOut' => null,
            ];
        }

        return $map;
    }

    public static function forPeriod(Period $period, ?string $from = null, ?string $to = null): array
    {
        $from = $from ?: $period->date_from->format('Y-m-d');
        $to = $to ?: $period->date_to->format('Y-m-d');
        $punches = $period->punches()->get(['ac_no', 'name', 'punch_date', 'minute', 'exception'])->map(fn ($p) => [
            'ac' => $p->ac_no, 'name' => $p->name, 'date' => is_string($p->punch_date) ? substr($p->punch_date, 0, 10) : $p->punch_date->format('Y-m-d'),
            'min' => (int) $p->minute, 'exc' => (string) $p->exception,
        ])->all();
        $settings = Setting::dtr();

        return [
            'period' => $period->period, 'from' => $from, 'to' => $to,
            'results' => DtrCalculator::compute($punches, self::employeeMap(), $settings, $from, $to),
            'noPunchDays' => self::noPunchDays($punches, $settings, $from, $to),
        ];
    }

    /** Work days with no punches from anyone (likely holidays) */
    private static function noPunchDays(array $punches, array $s, string $from, string $to): array
    {
        $days = array_flip(array_column($punches, 'date'));
        $hol = array_flip(array_column($s['holidays'], 'date'));
        $out = [];
        for ($d = $from; $d <= $to; $d = TimeUtil::addDays($d, 1)) {
            if (in_array(TimeUtil::dow($d), $s['workDays'], true) && ! isset($days[$d]) && ! isset($hol[$d])) {
                $out[] = $d;
            }
        }

        return $out;
    }
}
