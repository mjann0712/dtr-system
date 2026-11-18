<?php

namespace App\Services\Dtr;

/**
 * Reads the bare BIFF2–BIFF5 worksheet streams that many biometric devices
 * save with an .xls extension (no OLE container, so PhpSpreadsheet rejects them).
 * Supports the cell records these exports use: LABEL, NUMBER, INTEGER and RK.
 */
class BiffStreamReader
{
    public static function looksLikeBiffStream(string $path): bool
    {
        $h = @file_get_contents($path, false, null, 0, 2);
        if ($h === false || strlen($h) < 2) {
            return false;
        }
        $type = unpack('v', $h)[1];

        // BOF record ids for BIFF2 (0x0009), BIFF3 (0x0209), BIFF4 (0x0409), BIFF5/8 (0x0809)
        return in_array($type, [0x0009, 0x0209, 0x0409, 0x0809], true);
    }

    /** @return array<int, array{name: string, rows: array}> */
    public static function load(string $path, string $displayName): array
    {
        $b = file_get_contents($path);
        $len = strlen($b);
        $i = 0;
        $sheets = [];
        $cells = [];
        $maxRow = -1;
        $maxCol = -1;
        $flush = function () use (&$sheets, &$cells, &$maxRow, &$maxCol, $displayName) {
            if ($maxRow < 0) {
                return;
            }
            $rows = [];
            for ($r = 0; $r <= $maxRow; $r++) {
                $row = [];
                for ($c = 0; $c <= $maxCol; $c++) {
                    $row[] = $cells[$r][$c] ?? null;
                }
                $rows[] = $row;
            }
            $sheets[] = ['name' => $displayName.' · Sheet'.(count($sheets) + 1), 'rows' => $rows];
            $cells = [];
            $maxRow = $maxCol = -1;
        };
        $text = fn (string $s) => mb_convert_encoding($s, 'UTF-8', 'Windows-1252');
        $put = function (int $r, int $c, $v) use (&$cells, &$maxRow, &$maxCol) {
            $cells[$r][$c] = $v;
            $maxRow = max($maxRow, $r);
            $maxCol = max($maxCol, $c);
        };

        while ($i + 4 <= $len) {
            ['t' => $t, 'l' => $l] = unpack('vt/vl', $b, $i);
            $d = substr($b, $i + 4, $l);
            $i += 4 + $l;
            switch ($t) {
                case 0x0004: // LABEL (BIFF2): row, col, 3 attribute bytes, len u8, chars
                    ['r' => $r, 'c' => $c] = unpack('vr/vc', $d);
                    $put($r, $c, $text(substr($d, 8, ord($d[7]))));
                    break;
                case 0x0204: // LABEL (BIFF3–5): row, col, xf, len u16, chars
                    ['r' => $r, 'c' => $c, 'n' => $n] = unpack('vr/vc/vx/vn', $d);
                    $put($r, $c, $text(substr($d, 8, $n)));
                    break;
                case 0x0003: // NUMBER (BIFF2)
                    ['r' => $r, 'c' => $c] = unpack('vr/vc', $d);
                    $put($r, $c, unpack('e', substr($d, 7, 8))[1]);
                    break;
                case 0x0203: // NUMBER (BIFF3+)
                    ['r' => $r, 'c' => $c] = unpack('vr/vc', $d);
                    $put($r, $c, unpack('e', substr($d, 6, 8))[1]);
                    break;
                case 0x0002: // INTEGER (BIFF2)
                    ['r' => $r, 'c' => $c] = unpack('vr/vc', $d);
                    $put($r, $c, unpack('v', substr($d, 7, 2))[1]);
                    break;
                case 0x027E: // RK
                    ['r' => $r, 'c' => $c, 'rk' => $rk] = unpack('vr/vc/vx/Vrk', $d);
                    $put($r, $c, self::rk($rk));
                    break;
                case 0x000A: // EOF ends a worksheet
                    $flush();
                    break;
            }
        }
        $flush();

        return $sheets;
    }

    private static function rk(int $rk): float|int
    {
        $div = $rk & 1;
        if ($rk & 2) {
            $v = $rk >> 2;
            if ($v & 0x20000000) {
                $v -= 0x40000000;
            }
        } else {
            $v = unpack('e', pack('V', 0).pack('V', $rk & 0xFFFFFFFC))[1];
        }

        return $div ? $v / 100 : $v;
    }
}
