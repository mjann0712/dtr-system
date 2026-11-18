<?php

namespace App\Services\Dtr;

use PhpOffice\PhpSpreadsheet\IOFactory;

/**
 * Loads an uploaded workbook (.xls, .xlsx, .csv) into plain rows.
 * Values are raw (dates stay as Excel serial numbers), matching what the readers expect.
 */
class SheetLoader
{
    /** @return array<int, array{name: string, rows: array}> */
    public static function load(string $path, string $displayName): array
    {
        if (BiffStreamReader::looksLikeBiffStream($path)) {
            return BiffStreamReader::load($path, $displayName);
        }
        if (preg_match('/\.csv$/i', $displayName)) {
            $reader = new \PhpOffice\PhpSpreadsheet\Reader\Csv;
            $reader->setReadDataOnly(true);
            $book = $reader->load($path);
            $rows = $book->getActiveSheet()->toArray(null, true, false, false);

            return [['name' => $displayName, 'rows' => $rows]];
        }
        $reader = IOFactory::createReaderForFile($path);
        $reader->setReadDataOnly(true);
        $book = $reader->load($path);
        $sheets = [];
        foreach ($book->getWorksheetIterator() as $ws) {
            $rows = $ws->toArray(null, true, false, false);
            // drop fully empty trailing rows to keep memory down
            while ($rows && ! array_filter(end($rows), fn ($v) => $v !== null && $v !== '')) {
                array_pop($rows);
            }
            $sheets[] = ['name' => "{$displayName} · {$ws->getTitle()}", 'rows' => $rows];
        }
        $book->disconnectWorksheets();

        return $sheets;
    }
}
