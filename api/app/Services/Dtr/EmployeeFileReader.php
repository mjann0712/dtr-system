<?php

namespace App\Services\Dtr;

/**
 * Reads an HR employee records workbook (EMPLOYEE ID, name, POSITION / DEPARTMENT ...).
 * Picks the sheet with the most rows. Sensitive columns (government IDs,
 * birthdate, address, contacts) are deliberately ignored.
 */
class EmployeeFileReader
{
    private const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

    public static function isoDate(mixed $v): string
    {
        if ($v === null || $v === '') {
            return '';
        }
        if ($v instanceof \DateTimeInterface) {
            return $v->format('Y-m-d');
        }
        if ((is_int($v) || is_float($v)) && $v > 1000) {
            return TimeUtil::serialParts((float) $v)['date'];
        }
        $s = trim((string) $v);
        if (preg_match('/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/', $s, $m)) {
            $y = strlen($m[3]) === 2 ? '20'.$m[3] : $m[3];

            return sprintf('%04d-%02d-%02d', $y, $m[1], $m[2]);
        }
        if (preg_match('/^(\d{4})-(\d{1,2})-(\d{1,2})/', $s, $m)) {
            return sprintf('%04d-%02d-%02d', $m[1], $m[2], $m[3]);
        }
        if (preg_match('/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/', $s, $m)) {
            $mi = array_search(strtolower(substr($m[1], 0, 3)), self::MONTHS, true);
            if ($mi !== false) {
                return sprintf('%04d-%02d-%02d', $m[3], $mi + 1, $m[2]);
            }
        }

        return '';
    }

    /** Department from the position text; HR can change it on the record. */
    public static function guessDept(string $position, string $id = ''): string
    {
        $p = ' '.strtoupper(preg_replace('/[.,\/]/', ' ', $position)).' ';
        $rules = [
            '/\bTED\b|TEACHER EDUC/' => 'TED', '/\bDHM\b|[\s-]HM\b|HOSPITALITY/' => 'DHM', '/\bDTS\b|THEOLOG/' => 'DTS',
            '/\bDBA\b|[\s-]BA\b|BUSINESS/' => 'DBA', '/\bDCJE\b|CRIM/' => 'DCJE', '/\bDON\b|NURSING|CLINICAL INSTRUCTOR/' => 'DON',
            '/ALLIED/' => 'ALLIED', '/SENIOR HIGH|\bSHS\b/' => 'SHS', '/JUNIOR HIGH|\bJHS\b/' => 'JHS', '/\bSPED\b/' => 'SPED',
            '/ELEMENTARY|\bELEM\b/' => 'ELEM', '/GENERAL SERVICE|CARPENT|MAINTENANCE|UTILITY|POLLUTION/' => 'GEN SERVICES',
            '/REGISTRAR|RECORDS/' => 'REGISTRAR', '/FINANCE|TREASUR|ACCOUNT|PAYROLL|PURCHAS|CASHIER/' => 'FINANCE',
            '/ACADEMIC AFFAIRS|OVPAA/' => 'OVPAA', '/PRESIDENT/' => 'OP',
        ];
        foreach ($rules as $re => $dept) {
            if (preg_match($re, $p)) {
                return $dept;
            }
        }
        $pre = strtoupper(explode('-', $id)[0] ?? '');

        return ['CN' => 'DON', 'EL' => 'ELEM', 'SP' => 'SPED', 'MS' => 'GEN SERVICES'][$pre] ?? '';
    }

    private static function h($s): string
    {
        return preg_replace('/\s+/', ' ', strtolower(trim((string) ($s ?? ''))));
    }

    private static function find(array $row, string $re): int
    {
        foreach ($row as $i => $c) {
            if (preg_match($re, $c)) {
                return $i;
            }
        }

        return -1;
    }

    /** @return null|array{sheet: string, employees: array, duplicates: int} */
    public static function read(array $sheets): ?array
    {
        $best = null;
        foreach ($sheets as $sh) {
            $max = min(10, count($sh['rows']));
            for ($r = 0; $r < $max; $r++) {
                $row = array_map([self::class, 'h'], array_values($sh['rows'][$r] ?? []));
                $id = self::find($row, '/^(employee id|emp(loyee)? ?(no|#)\.?|id ?no\.?)$/');
                $full = self::find($row, '/^(employee name|name|full name)$/');
                $ln = self::find($row, '/^(employee lname|last ?name|surname|lname)$/');
                $fn = self::find($row, '/^(employee fname|first ?name|fname|given name)$/');
                if ($id < 0 || ($full < 0 && $ln < 0)) {
                    continue;
                }
                if (self::find($row, '/^(date|time|clock in 1)$/') >= 0) {
                    continue;
                }
                $pos = self::find($row, '/^(position|position ?\/ ?department|designation)$/');
                $deptC = self::find($row, '/^(dept|department|office|unit)$/');
                $gender = self::find($row, '/^(gender|sex)$/');
                $hired = self::find($row, '/^(doemployement|doemployment|date (of )?employ(e)?ment|date hired|hired)$/');
                $ac = self::find($row, '/^(ac[-\s.]*no\.?|ac#|biometric( id| no\.?)?)$/');
                $status = self::find($row, '/^(status|employment status)$/');

                $rows = [];
                for ($i = $r + 1; $i < count($sh['rows']); $i++) {
                    $x = array_values($sh['rows'][$i] ?? []);
                    $eid = strtoupper(trim((string) ($x[$id] ?? '')));
                    if ($eid === '' || $eid === '-') {
                        continue;
                    }
                    $lname = $ln >= 0 ? trim((string) ($x[$ln] ?? '')) : '';
                    $fname = $fn >= 0 ? trim((string) ($x[$fn] ?? '')) : '';
                    if ($lname === '' && $full >= 0) {
                        $f = trim((string) ($x[$full] ?? ''));
                        $k = strpos($f, ',');
                        $lname = $k !== false ? trim(substr($f, 0, $k)) : $f;
                        $fname = $k !== false ? trim(substr($f, $k + 1)) : '';
                    }
                    if ($lname === '') {
                        continue;
                    }
                    $lname = mb_strtoupper($lname);
                    $fname = mb_strtoupper(preg_replace('/\s+/', ' ', $fname));
                    $position = $pos >= 0 ? trim((string) ($x[$pos] ?? '')) : '';
                    $deptCol = $deptC >= 0 ? strtoupper(trim((string) ($x[$deptC] ?? ''))) : '';
                    $dept = $deptCol ?: self::guessDept($position, $eid);
                    $acNos = [];
                    if ($ac >= 0 && ($x[$ac] ?? '') !== '' && $x[$ac] !== null) {
                        foreach (preg_split('/[,;\s]+/', (string) $x[$ac]) as $a) {
                            if ($a !== '') {
                                $acNos[] = preg_replace('/\.0+$/', '', $a);
                            }
                        }
                    }
                    $rows[] = [
                        'employee_id' => $eid, 'last_name' => $lname, 'first_name' => $fname,
                        'name' => rtrim($fname !== '' ? "{$lname}, {$fname}" : $lname, ', '),
                        'position' => $position, 'department' => $dept,
                        'department_source' => $deptCol ? 'file' : ($dept ? 'position' : null),
                        'gender' => $gender >= 0 ? trim((string) ($x[$gender] ?? '')) : '',
                        'date_hired' => $hired >= 0 ? (self::isoDate($x[$hired] ?? null) ?: null) : null,
                        'ac_nos' => $acNos,
                        'status' => ($status >= 0 && preg_match('/inactive|resign|separat/i', (string) ($x[$status] ?? ''))) ? 'Inactive' : 'Active',
                    ];
                }
                if (! $best || count($rows) > count($best['rows'])) {
                    $best = ['sheet' => $sh['name'], 'rows' => $rows];
                }
                break;
            }
        }
        if (! $best) {
            return null;
        }
        $byId = [];
        $dup = 0;
        foreach ($best['rows'] as $e) {
            if (isset($byId[$e['employee_id']])) {
                $dup++;
            }
            $byId[$e['employee_id']] = $e;
        }

        return ['sheet' => $best['sheet'], 'employees' => array_values($byId), 'duplicates' => $dup];
    }
}
