<?php

namespace App\Services\Dtr;

/**
 * Matches names printed by the time-clock ("BUDADDA, MAEL T", "PAGAO GERALDINE O",
 * "Calixto Emilia") to employee records ("LNAME, FNAME M.").
 * level 'high'   = same last name and first name -> safe to link automatically
 * level 'medium' = only one record with that last name -> suggest, HR confirms
 */
class NameMatcher
{
    /** @var array<string, array<int, array{e: array, k: array}>> */
    private array $idx = [];

    /** @param  array<int, array>  $employees  each with at least 'name' */
    public function __construct(array $employees)
    {
        foreach ($employees as $e) {
            $k = self::keyOf($e['name']);
            $this->idx[$k['l']][] = ['e' => $e, 'k' => $k];
        }
    }

    public static function norm(string $s): string
    {
        $s = mb_strtoupper($s);
        $s = \Normalizer::normalize($s, \Normalizer::FORM_D) ?: $s;
        $s = preg_replace('/\p{Mn}+/u', '', $s);
        $s = preg_replace('/[^A-Z ,\-]/', ' ', $s);

        return trim(preg_replace('/\s+/', ' ', $s));
    }

    private static function keyOf(string $full): array
    {
        $parts = explode(',', self::norm($full), 2);
        $l = preg_replace('/[\s\-]/', '', $parts[0] ?? '');
        $f = trim($parts[1] ?? '');

        return ['l' => $l, 'f' => $f, 'first' => explode(' ', $f)[0] ?? ''];
    }

    /** @return array{emp: ?array, level: ?string, candidates: array} */
    public function match(string $bioName): array
    {
        $n = ltrim(self::norm($bioName), ' ,');
        $t = explode(' ', $n);
        $forms = str_contains($n, ',') ? [$n] : [
            $t[0].', '.implode(' ', array_slice($t, 1)),
            end($t).', '.implode(' ', array_slice($t, 0, -1)),
            implode('', array_slice($t, -2)).', '.implode(' ', array_slice($t, 0, -2)),
        ];
        foreach ($forms as $form) {
            $k = self::keyOf($form);
            $c = $this->idx[$k['l']] ?? [];
            if (! $c) {
                continue;
            }
            $byFirst = array_values(array_filter($c, fn ($x) => $k['first'] !== '' && $x['k']['first'] !== '' &&
                ($x['k']['first'] === $k['first'] || str_starts_with($x['k']['f'], $k['first']) || str_starts_with($k['f'], $x['k']['first']))));
            if (count($byFirst) === 1) {
                return ['emp' => $byFirst[0]['e'], 'level' => 'high', 'candidates' => [$byFirst[0]['e']]];
            }
            if (count($byFirst) > 1) {
                return ['emp' => null, 'level' => null, 'candidates' => array_column($byFirst, 'e')];
            }

            return ['emp' => count($c) === 1 ? $c[0]['e'] : null, 'level' => count($c) === 1 ? 'medium' : null, 'candidates' => array_column($c, 'e')];
        }

        return ['emp' => null, 'level' => null, 'candidates' => []];
    }
}
