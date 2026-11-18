<?php

namespace App\Services\Dtr;

/**
 * Small time helpers shared by the readers and the calculator.
 * Minutes are minutes after midnight (0–1439).
 */
class TimeUtil
{
    /** "08:00", "8:05 AM", 0.3333 (Excel fraction) or 480 -> minutes */
    public static function hm(mixed $v): ?int
    {
        if ($v === null || $v === '') {
            return null;
        }
        if (is_int($v) || is_float($v)) {
            return $v < 1 ? (int) round($v * 1440) : (int) $v;
        }
        $s = trim((string) $v);
        if (! preg_match('/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/', $s, $m)) {
            return null;
        }
        $h = (int) $m[1];
        $mi = (int) $m[2];
        if (! empty($m[3])) {
            $pm = strtolower($m[3][0]) === 'p';
            if ($h === 12) {
                $h = 0;
            }
            if ($pm) {
                $h += 12;
            }
        }

        return $h * 60 + $mi;
    }

    public static function t12(?int $min): string
    {
        if ($min === null) {
            return '';
        }
        $h = intdiv($min, 60);
        $m = $min % 60;
        $ap = $h >= 12 ? 'PM' : 'AM';
        $h = $h % 12;
        if ($h === 0) {
            $h = 12;
        }

        return sprintf('%02d:%02d %s', $h, $m, $ap);
    }

    /** Excel serial -> [date 'Y-m-d', minutes] */
    public static function serialParts(float $v): array
    {
        $d = (int) floor($v + 1e-9);
        $mins = (int) round(($v - $d) * 1440);
        if ($mins >= 1440) {
            $mins -= 1440;
            $d++;
        }
        $date = gmdate('Y-m-d', (int) round(($d - 25569) * 86400));

        return ['date' => $date, 'min' => $mins];
    }

    /**
     * Parse a punch stamp: Excel serial, DateTimeInterface, or text such as
     * "9/2/2026 8:56 AM" (month/day/year) or "2026-09-02 08:56:00".
     */
    public static function parseStamp(mixed $v): ?array
    {
        if ($v === null || $v === '') {
            return null;
        }
        if ($v instanceof \DateTimeInterface) {
            return ['date' => $v->format('Y-m-d'), 'min' => (int) $v->format('G') * 60 + (int) $v->format('i')];
        }
        if (is_int($v) || is_float($v)) {
            return $v > 1000 ? self::serialParts((float) $v) : null;
        }
        $s = trim((string) $v);
        if (is_numeric($s) && (float) $s > 1000) {
            return self::serialParts((float) $s);
        }
        if (preg_match('/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})[ T]+(.+)$/', $s, $m)) {
            $date = sprintf('%04d-%02d-%02d', $m[1], $m[2], $m[3]);
            $rest = $m[4];
        } elseif (preg_match('/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})\s+(.+)$/', $s, $m)) {
            $y = strlen($m[3]) === 2 ? '20'.$m[3] : $m[3];
            $date = sprintf('%04d-%02d-%02d', $y, $m[1], $m[2]);
            $rest = $m[4];
        } else {
            return null;
        }
        $rest = preg_replace('/(\d)\s*([AaPp][Mm])$/', '$1 $2', preg_replace('/\s+/', ' ', $rest));
        $min = self::hm($rest);

        return $min === null ? null : ['date' => $date, 'min' => $min];
    }

    /** Date-only cell -> 'Y-m-d' */
    public static function parseDate(mixed $v): ?string
    {
        if ($v === null || $v === '') {
            return null;
        }
        if ($v instanceof \DateTimeInterface) {
            return $v->format('Y-m-d');
        }
        if (is_int($v) || is_float($v) || (is_string($v) && is_numeric($v))) {
            return (float) $v > 1000 ? self::serialParts((float) $v)['date'] : null;
        }
        $p = self::parseStamp(trim((string) $v).' 12:00 PM');

        return $p['date'] ?? null;
    }

    public static function dow(string $iso): int
    {
        return (int) gmdate('w', strtotime($iso.' 00:00:00 UTC'));
    }

    public static function addDays(string $iso, int $n): string
    {
        return gmdate('Y-m-d', strtotime($iso.' 00:00:00 UTC') + $n * 86400);
    }
}
