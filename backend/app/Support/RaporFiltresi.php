<?php

namespace App\Support;

use App\Models\Donem;
use Illuminate\Http\Request;

/**
 * Dönem raporunun daraltma ölçütleri.
 *
 * Filtreler yalnızca neyin gösterileceğini belirler; yetki değildir. Kapsam
 * kontrolü (hangi dönemi kim görebilir) BirimKapsami'nde yapılır ve bu nesne
 * oraya hiç karışmaz - kullanıcı filtreyle kendi kapsamını genişletemez.
 *
 * Boş bırakılan her alan "hepsi" anlamına gelir.
 */
class RaporFiltresi
{
    /**
     * @param  array<int, int>|null     $ayIds          Yalnızca bu aylar (dönem ayı id'leri)
     * @param  array<int, int>|null     $subeIds        Yalnızca bu şubeler
     * @param  array<int, string>|null  $kategoriler    Yalnızca bu kriter başlıkları
     * @param  array<int, string>|null  $kriterTurleri  Yalnızca bu puanlama türleri
     */
    public function __construct(
        public ?array $ayIds = null,
        public ?array $subeIds = null,
        public ?array $kategoriler = null,
        public ?array $kriterTurleri = null,
    ) {
    }

    /**
     * İstekten filtre kurar; tanınmayan değerler yok sayılır.
     *
     * Ay id'leri döneme ait olanlarla kesiştirilir: başka döneme ait bir id
     * gönderilirse sessizce kapsam dışına çıkmak yerine listeden düşer.
     */
    public static function istekten(Request $request, Donem $donem): self
    {
        $donemAyIds = $donem->aylar->pluck('id')->all();

        $ayIds = self::sayiListesi($request, 'ay_ids');
        $ayIds = $ayIds === null ? null : array_values(array_intersect($ayIds, $donemAyIds));

        return new self(
            ayIds: $ayIds ?: null,
            subeIds: self::sayiListesi($request, 'sube_ids'),
            kategoriler: self::metinListesi($request, 'kategoriler', KriterKategorileri::secilebilirler()),
            kriterTurleri: self::metinListesi($request, 'kriter_turleri', PuanHesaplayici::TURLER),
        );
    }

    /** Rapor bir ay aralığıyla mı sınırlı? */
    public function ayAraligiVarMi(): bool
    {
        return $this->ayIds !== null && $this->ayIds !== [];
    }

    /**
     * Seçili ayların dönemin kaçta kaçı olduğu.
     *
     * Hedefler bu oranla orantılanır; ay filtresi yoksa 1.0 döner ve puanlama
     * dönemin tamamı için olduğu gibi çalışır.
     */
    public function donemOrani(Donem $donem): float
    {
        $toplamAy = $donem->aylar->count();

        if (!$this->ayAraligiVarMi() || $toplamAy === 0) {
            return 1.0;
        }

        return min(1.0, count($this->ayIds) / $toplamAy);
    }

    /** Uygulanan filtreleri yanıtta geri döndürmek için - arayüz ne süzdüğünü gösterir. */
    public function ozet(): array
    {
        return [
            'ay_ids'         => $this->ayIds,
            'sube_ids'       => $this->subeIds,
            'kategoriler'    => $this->kategoriler,
            'kriter_turleri' => $this->kriterTurleri,
        ];
    }

    /** @return array<int, int>|null */
    private static function sayiListesi(Request $request, string $alan): ?array
    {
        if (!$request->filled($alan)) {
            return null;
        }

        $ham = $request->input($alan);
        $ham = is_array($ham) ? $ham : explode(',', (string) $ham);

        $temiz = array_values(array_unique(array_filter(
            array_map(fn ($d) => (int) trim((string) $d), $ham),
            fn (int $d) => $d > 0,
        )));

        return $temiz ?: null;
    }

    /**
     * @param  array<int, string>  $gecerliler
     * @return array<int, string>|null
     */
    private static function metinListesi(Request $request, string $alan, array $gecerliler): ?array
    {
        if (!$request->filled($alan)) {
            return null;
        }

        $ham = $request->input($alan);
        $ham = is_array($ham) ? $ham : explode(',', (string) $ham);

        $temiz = array_values(array_unique(array_intersect(
            array_map(fn ($d) => trim((string) $d), $ham),
            $gecerliler,
        )));

        return $temiz ?: null;
    }
}
