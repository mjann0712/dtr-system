<?php

namespace App\Services\Dtr;

/**
 * Reads time-clock exports. Accepts three layouts:
 *  - raw punch log:      AC-No. | Name | Time | State | Exception
 *  - daily summary:      AC-No. | Name | Date | Clock In 1 | Clock Out 1 | ...
 *  - biometric list:     AC# | NAME | DEPT  (links AC-Nos to departments)
 * When both a raw log and a daily summary are given, the raw log wins.
 *
 * @phpstan-type Sheet array{name: string, rows: array<int, array<int, mixed>>}
 */
class TimeClockReader
{
    private static function norm($v): string
    {
        return strtolower(trim((string) ($v ?? '')));
    }

    private static function idx(array $r, string $re): int
    {
        foreach ($r as $i => $c) {
            if (preg_match($re, $c)) {
                return $i;
            }
        }

        return -1;
    }

    private static function findHeader(array $rows, callable $test): ?array
    {
        $max = min(count($rows), 15);
        for ($i = 0; $i < $max; $i++) {
            $r = array_map([self::class, 'norm'], array_values($rows[$i] ?? []));
            $res = $test($r);
            if ($res) {
                return ['row' => $i, 'cols' => $res];
            }
        }

        return null;
    }

    private static function acCol(array $r): int
    {
        $a = self::idx($r, '/^(ac[-\s.]*no\.?|ac#)$/');

        return $a >= 0 ? $a : self::idx($r, '/^(emp(loyee)?[-\s.]*(no|id|#)\.?|user[-\s]*id|id|enroll(ment)?[-\s]*no\.?)$/');
    }

    private static function cleanAc($v): string
    {
        return preg_replace('/\.0+$/', '', trim((string) $v));
    }

    /** @param  Sheet[]  $sheets */
    public static function read(array $sheets): array
    {
        $punches = [];
        $summary = [];
        $employees = [];
        $found = ['punchSheets' => [], 'empSheets' => []];

        foreach ($sheets as $sh) {
            $rows = $sh['rows'];

            // daily summary
            $smh = self::findHeader($rows, function ($r) {
                $ac = self::acCol($r);
                $date = self::idx($r, '/^date$/');
                $clocks = [];
                foreach ($r as $i => $c) {
                    if (preg_match('/^clock[\s-]*(in|out)[\s-]*\d+$/', $c)) {
                        $clocks[] = $i;
                    }
                }
                if ($ac < 0 || $date < 0 || ! $clocks) {
                    return null;
                }

                return ['ac' => $ac, 'date' => $date, 'clocks' => $clocks, 'name' => self::idx($r, '/^name$/')];
            });
            if ($smh) {
                $c = $smh['cols'];
                $n = 0;
                for ($i = $smh['row'] + 1; $i < count($rows); $i++) {
                    $r = array_values($rows[$i] ?? []);
                    $acRaw = $r[$c['ac']] ?? null;
                    $dv = $r[$c['date']] ?? null;
                    if ($acRaw === null || $acRaw === '' || $dv === null || $dv === '') {
                        continue;
                    }
                    $date = TimeUtil::parseDate($dv);
                    if (! $date) {
                        continue;
                    }
                    foreach ($c['clocks'] as $ci) {
                        $tv = $r[$ci] ?? null;
                        if ($tv === null || $tv === '') {
                            continue;
                        }
                        $min = (is_int($tv) || is_float($tv)) ? ((int) round(fmod((float) $tv, 1) * 1440)) % 1440 : TimeUtil::hm(preg_replace('/(\d)\s*([AaPp][Mm])$/', '$1 $2', trim((string) $tv)));
                        if ($min === null) {
                            continue;
                        }
                        $summary[] = ['ac' => self::cleanAc($acRaw), 'name' => $c['name'] >= 0 ? trim((string) ($r[$c['name']] ?? '')) : '', 'date' => $date, 'min' => $min, 'state' => '', 'exc' => ''];
                        $n++;
                    }
                }
                $found['punchSheets'][] = "{$sh['name']} (daily summary, ".number_format($n).' punches)';

                continue;
            }

            // raw punch log
            $ph = self::findHeader($rows, function ($r) {
                $ac = self::acCol($r);
                $time = self::idx($r, '/^(time|date[\s\/]*time|datetime|check[\s-]*time|timestamp)$/');
                if ($ac < 0 || $time < 0) {
                    return null;
                }

                return ['ac' => $ac, 'time' => $time, 'name' => self::idx($r, '/^name$/'), 'state' => self::idx($r, '/^state$/'), 'exc' => self::idx($r, '/^exception$/')];
            });
            if ($ph) {
                $c = $ph['cols'];
                $n = 0;
                for ($i = $ph['row'] + 1; $i < count($rows); $i++) {
                    $r = array_values($rows[$i] ?? []);
                    $acRaw = $r[$c['ac']] ?? null;
                    if ($acRaw === null || $acRaw === '') {
                        continue;
                    }
                    $st = TimeUtil::parseStamp($r[$c['time']] ?? null);
                    if (! $st) {
                        continue;
                    }
                    $punches[] = [
                        'ac' => self::cleanAc($acRaw),
                        'name' => $c['name'] >= 0 ? trim((string) ($r[$c['name']] ?? '')) : '',
                        'date' => $st['date'], 'min' => $st['min'],
                        'state' => $c['state'] >= 0 ? (string) ($r[$c['state']] ?? '') : '',
                        'exc' => $c['exc'] >= 0 ? (string) ($r[$c['exc']] ?? '') : '',
                    ];
                    $n++;
                }
                $found['punchSheets'][] = "{$sh['name']} (".number_format($n).' punches)';

                continue;
            }

            // biometric list (AC#, NAME, DEPT)
            $eh = self::findHeader($rows, function ($r) {
                $name = self::idx($r, '/^(name|employee|employee name|full name)$/');
                $dept = self::idx($r, '/^(dept|department|office|unit)$/');
                if ($name < 0 || $dept < 0) {
                    return null;
                }
                foreach ($r as $c) {
                    if (preg_match('/date|clock|^in$|^out$/', $c)) {
                        return null;
                    }
                }
                $ac = self::idx($r, '/^(ac[-\s.]*no\.?|ac#|\.|no\.?|emp(loyee)?[-\s.]*(no|id|#)\.?|id)$/');
                if ($ac < 0) {
                    $ac = 0;
                }
                $a2 = self::idx($r, '/^(ac[-\s.]*no\.?|ac#)$/');
                if ($a2 >= 0) {
                    $ac = $a2;
                }

                return ['ac' => $ac, 'name' => $name, 'dept' => $dept,
                    'inst' => self::idx($r, '/^(institution|campus|school|division)$/'),
                    'amIn' => self::idx($r, '/^(time[\s-]*in|am[\s-]*in|start|sched(ule)?[\s-]*in)$/'),
                    'pmOut' => self::idx($r, '/^(time[\s-]*out|pm[\s-]*out|end|sched(ule)?[\s-]*out)$/')];
            });
            if ($eh) {
                $c = $eh['cols'];
                $n = 0;
                for ($i = $eh['row'] + 1; $i < count($rows); $i++) {
                    $r = array_values($rows[$i] ?? []);
                    $name = trim((string) ($r[$c['name']] ?? ''));
                    $acRaw = $r[$c['ac']] ?? null;
                    if ($name === '' || $acRaw === null || $acRaw === '') {
                        continue;
                    }
                    $ac = self::cleanAc($acRaw);
                    $employees[$ac] = [
                        'ac' => $ac, 'name' => $name,
                        'dept' => strtoupper(trim((string) ($r[$c['dept']] ?? ''))) ?: 'UNASSIGNED',
                        'inst' => $c['inst'] >= 0 ? trim((string) ($r[$c['inst']] ?? '')) : '',
                        'amIn' => $c['amIn'] >= 0 ? TimeUtil::hm($r[$c['amIn']] ?? null) : null,
                        'pmOut' => $c['pmOut'] >= 0 ? TimeUtil::hm($r[$c['pmOut']] ?? null) : null,
                    ];
                    $n++;
                }
                $found['empSheets'][] = "{$sh['name']} ({$n} employees)";
            }
        }

        if ($punches && $summary) {
            $found['punchSheets'] = array_map(fn ($x) => str_contains($x, 'daily summary') ? preg_replace('/\(daily summary.*\)/', '(daily summary, not needed: raw log used)', $x) : $x, $found['punchSheets']);
        } elseif ($summary) {
            $punches = $summary;
        }

        return ['punches' => $punches, 'employees' => $employees, 'found' => $found];
    }
}
