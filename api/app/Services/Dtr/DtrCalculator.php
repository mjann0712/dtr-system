<?php

namespace App\Services\Dtr;

/**
 * Turns raw punches into daily time records: pairs time in / time out by
 * time window, then computes hours worked, late, undertime and absences.
 *
 * Kept free of Laravel so it can be unit-tested on its own.
 */
class DtrCalculator
{
    public const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    public static function defaults(): array
    {
        return [
            'workDays' => [1, 2, 3, 4, 5, 6],
            'holidays' => [],                 // [['date' => '2026-09-01', 'label' => 'HOLIDAY']]
            'sched' => ['amIn' => '08:00', 'amOut' => '12:00', 'pmIn' => '13:00', 'pmOut' => '17:00'],
            'deptSched' => [],                // DEPT => ['amIn'.., 'workDays' => [..]]
            'grace' => 0,
            'dedupe' => 5,
            'ignoreInvalid' => false,
            'lunchRule' => true,
            'capToSched' => false,
            'includeNoPunch' => false,
            'compact' => false,
            'institutions' => [],             // DEPT => institution
            'meta' => ['org' => '', 'docNo' => 'F-HR-810-010', 'revNo' => '0', 'effDate' => '', 'verifier' => 'Department Head', 'noter' => 'HR Officer'],
        ];
    }

    public static function schedFor(?array $emp, array $s): array
    {
        $dept = $emp['dept'] ?? '';
        $base = array_merge($s['sched'], array_intersect_key($s['deptSched'][$dept] ?? [], array_flip(['amIn', 'amOut', 'pmIn', 'pmOut'])));
        $o = [
            'amIn' => TimeUtil::hm($base['amIn']), 'amOut' => TimeUtil::hm($base['amOut']),
            'pmIn' => TimeUtil::hm($base['pmIn']), 'pmOut' => TimeUtil::hm($base['pmOut']),
        ];
        if (isset($emp['amIn']) && $emp['amIn'] !== null) {
            $o['amIn'] = (int) $emp['amIn'];
        }
        if (isset($emp['pmOut']) && $emp['pmOut'] !== null) {
            $o['pmOut'] = (int) $emp['pmOut'];
        }

        return $o;
    }

    private static function overlap(int $a1, int $a2, int $b1, int $b2): int
    {
        return max(0, min($a2, $b2) - max($a1, $b1));
    }

    public static function computeDay(array $mins, array $sc, array $s, bool $isWork, string $holiday): array
    {
        sort($mins);
        $p = [];
        foreach ($mins as $m) {
            if ($p && $m - end($p) < $s['dedupe']) {
                continue;
            }
            $p[] = (int) $m;
        }
        $n = count($p);
        $d = ['slots' => [null, null, null, null], 'worked' => 0, 'late' => 0, 'early' => 0, 'absent' => 0, 'remarks' => [], 'punches' => $n, 'flag' => ''];

        // Assign punches to AM-IN / LUNCH-OUT / LUNCH-IN / PM-OUT by time window
        $L0 = $sc['amOut'] - 60;
        $L1 = $sc['pmIn'] + 60;
        $M = array_values(array_filter($p, fn ($x) => $x < $L0));
        $X = array_values(array_filter($p, fn ($x) => $x >= $L0 && $x <= $L1));
        $A = array_values(array_filter($p, fn ($x) => $x > $L1));
        $in1 = $M[0] ?? null;
        $out2 = $A ? end($A) : null;
        $out1 = null;
        $in2 = null;
        $lunchGap = false;
        if (count($X) >= 2) {
            $out1 = $X[0];
            $in2 = end($X);
        } elseif (count($X) === 1) {
            if ($in1 !== null && $out2 === null) {
                $out1 = $X[0];
            } elseif ($in1 === null && $out2 !== null) {
                $in2 = $X[0];
            } elseif ($in1 === null && $out2 === null) {
                if ($X[0] < $sc['amOut']) {
                    $in1 = $X[0];
                } else {
                    $in2 = $X[0];
                }
            } else {
                $lunchGap = true;
            }
        }
        if ($in1 !== null && $out1 === null && $in2 === null && $out2 === null && count($M) >= 2) {
            $out1 = end($M);
        }
        if ($in1 === null && $in2 === null && $out1 === null && count($A) >= 2) {
            $in2 = $A[0];
        }
        $d['slots'] = [$in1, $out1, $in2, $out2];

        $start = $in1 ?? $in2;
        $end = $out2 ?? $out1;
        $lo = $s['capToSched'] ? $sc['amIn'] : -1;
        $hi = $s['capToSched'] ? $sc['pmOut'] : 99999;
        $span = fn ($a, $b) => max(0, min($b, $hi) - max($a, $lo));
        if ($in1 !== null && $out1 !== null && $in2 !== null && $out2 !== null) {
            $d['worked'] = $span($in1, $out1) + $span($in2, $out2);
        } elseif ($start !== null && $end !== null && $end > $start) {
            $d['worked'] = $span($start, $end) - self::overlap(max($start, $lo), min($end, $hi), $sc['amOut'], $sc['pmIn']);
        }
        $d['worked'] = max(0, $d['worked']);

        if ($holiday !== '') {
            $d['remarks'][] = $holiday;
        } elseif (! $isWork && $n) {
            $d['remarks'][] = 'REST DAY';
        }
        if (! $isWork || $holiday !== '') {
            return $d;
        }
        if ($n === 0) {
            $d['absent'] = 1;
            $d['remarks'][] = 'ABSENT';

            return $d;
        }

        $g = (int) $s['grace'];
        $pmOnly = $in1 === null && $in2 !== null;
        $amOnly = $out2 === null && $in2 === null && $out1 !== null;
        if ($in1 !== null) {
            if ($in1 > $sc['amIn'] + $g) {
                $d['late'] += $in1 - $sc['amIn'];
            }
        } elseif ($in2 !== null) {
            if ($in2 > $sc['pmIn'] + $g) {
                $d['late'] += $in2 - $sc['pmIn'];
            }
        }
        if ($out2 !== null) {
            if ($out2 < $sc['pmOut']) {
                $d['early'] += $sc['pmOut'] - $out2;
            }
        } elseif ($out1 !== null && $amOnly) {
            if ($out1 < $sc['amOut']) {
                $d['early'] += $sc['amOut'] - $out1;
            }
        }
        if ($s['lunchRule'] && $in1 !== null && $out1 !== null && $in2 !== null && $out2 !== null) {
            if ($out1 < $sc['amOut']) {
                $d['early'] += $sc['amOut'] - $out1;
            }
            if ($in2 > $sc['pmIn'] + $g) {
                $d['late'] += $in2 - $sc['pmIn'];
            }
        }
        if ($pmOnly || $amOnly) {
            $d['absent'] = 0.5;
            $d['remarks'][] = $amOnly ? 'HALF DAY (AM)' : 'HALF DAY (PM)';
        }
        if ($start === null) {
            $d['remarks'][] = 'NO TIME IN';
            $d['flag'] = 'incomplete';
        } elseif ($end === null) {
            $d['remarks'][] = 'NO TIME OUT';
            $d['flag'] = 'incomplete';
        } elseif ($lunchGap) {
            $d['remarks'][] = 'INCOMPLETE LUNCH PUNCH';
        }

        return $d;
    }

    /**
     * @param  array  $punches  list of ['ac','name','date','min','exc']
     * @param  array  $employees  ac => ['ac','name','dept','inst','empId','position','status','amIn','pmOut']
     * @return array list of employee results
     */
    public static function compute(array $punches, array $employees, array $settings, string $from, string $to): array
    {
        $s = array_replace(self::defaults(), $settings);
        $hol = [];
        foreach ($s['holidays'] as $h) {
            $hol[$h['date']] = strtoupper($h['label'] ?? 'HOLIDAY') ?: 'HOLIDAY';
        }
        $work = array_flip($s['workDays']);

        $byEmp = [];
        foreach ($punches as $pu) {
            if ($pu['date'] < $from || $pu['date'] > $to) {
                continue;
            }
            if ($s['ignoreInvalid'] && stripos($pu['exc'] ?? '', 'invalid') !== false) {
                continue;
            }
            $ac = (string) $pu['ac'];
            $byEmp[$ac] ??= ['name' => $pu['name'] ?? '', 'days' => []];
            $byEmp[$ac]['days'][$pu['date']][] = (int) $pu['min'];
        }
        $acs = array_keys($byEmp);
        if ($s['includeNoPunch']) {
            $acs = array_unique(array_merge($acs, array_map('strval', array_keys($employees))));
        }

        $dates = [];
        for ($d = $from; $d <= $to; $d = TimeUtil::addDays($d, 1)) {
            $dates[] = $d;
        }

        $out = [];
        foreach ($acs as $ac) {
            $ac = (string) $ac;
            $master = $employees[$ac] ?? null;
            $pe = $byEmp[$ac] ?? ['name' => '', 'days' => []];
            $dept = $master['dept'] ?? '' ?: 'UNASSIGNED';
            $emp = [
                'ac' => $ac,
                'name' => $master['name'] ?? ($pe['name'] ?: "AC {$ac}"),
                'dept' => $dept,
                'inMaster' => $master !== null,
                'empId' => $master['empId'] ?? null,
                'position' => $master['position'] ?? '',
                'status' => $master['status'] ?? null,
            ];
            $emp['inst'] = ($master['inst'] ?? '') ?: ($s['institutions'][$dept] ?? 'Unassigned');
            $sc = self::schedFor(array_merge($master ?? [], ['dept' => $dept]), $s);
            $emp['sched'] = $sc;
            $dsc = $s['deptSched'][$dept] ?? null;
            $empWork = ($dsc && isset($dsc['workDays']) && is_array($dsc['workDays'])) ? array_flip($dsc['workDays']) : $work;

            $rows = [];
            $t = ['worked' => 0, 'late' => 0, 'lateCount' => 0, 'early' => 0, 'absent' => 0, 'present' => 0, 'incomplete' => 0, 'workdays' => 0];
            foreach ($dates as $date) {
                $wd = TimeUtil::dow($date);
                $isWork = isset($empWork[$wd]);
                $holiday = $hol[$date] ?? '';
                $mins = $pe['days'][$date] ?? [];
                if (! $isWork && ! $mins && $holiday === '') {
                    continue;
                }
                $r = self::computeDay($mins, $sc, $s, $isWork, $holiday);
                $r['date'] = $date;
                $r['dow'] = self::DOW[$wd];
                $rows[] = $r;
                if ($isWork && $holiday === '') {
                    $t['workdays']++;
                }
                $t['worked'] += $r['worked'];
                $t['late'] += $r['late'];
                if ($r['late']) {
                    $t['lateCount']++;
                }
                $t['early'] += $r['early'];
                $t['absent'] += $r['absent'];
                if ($r['punches']) {
                    $t['present']++;
                }
                if ($r['flag'] === 'incomplete') {
                    $t['incomplete']++;
                }
            }
            $emp['rows'] = $rows;
            $emp['totals'] = $t;
            $out[] = $emp;
        }
        usort($out, fn ($a, $b) => strcmp($a['dept'], $b['dept']) ?: strcmp($a['name'], $b['name']));

        return $out;
    }

    /** The calendar month holding most punches -> ['from','to'] */
    public static function guessPeriod(array $punches): ?array
    {
        $c = [];
        foreach ($punches as $p) {
            $k = substr($p['date'], 0, 7);
            $c[$k] = ($c[$k] ?? 0) + 1;
        }
        if (! $c) {
            return null;
        }
        arsort($c);
        $best = array_key_first($c);
        [$y, $m] = array_map('intval', explode('-', $best));
        $last = (int) gmdate('t', gmmktime(0, 0, 0, $m, 1, $y));

        return ['from' => "{$best}-01", 'to' => sprintf('%s-%02d', $best, $last), 'period' => $best];
    }
}
