<?php

namespace App\Support;

/**
 * Gereksinim dokümanı bölüm 7'de tanımlanan kriter başlıkları. Kriterlerin
 * amacı yalnızca "kaç faaliyet yapıldı" sorusuna cevap vermek değil; şubenin
 * farklı yönlerini ölçmek. Bu kategoriler raporda "hangi konuda başarılı,
 * hangi konuda gelişmeye ihtiyaç var" kırılımını üretir (bölüm 8).
 */
class KriterKategorileri
{
    public const FAALIYET_URETKENLIGI = 'faaliyet_uretkenligi';
    public const UYE_CALISMALARI = 'uye_calismalari';
    public const TESKILATLANMA = 'teskilatlanma';
    public const SEKTOREL = 'sektorel';
    public const ETKINLIK = 'etkinlik';
    public const HEDEF_GERCEKLESTIRME = 'hedef_gerceklestirme';

    /** Kategorisi girilmemiş faaliyetler bu başlık altında toplanır. */
    public const SINIFLANDIRILMAMIS = 'siniflandirilmamis';

    public const ETIKETLER = [
        self::FAALIYET_URETKENLIGI => 'Faaliyet Üretkenliği',
        self::UYE_CALISMALARI      => 'Üye Çalışmaları',
        self::TESKILATLANMA        => 'Teşkilatlanma',
        self::SEKTOREL             => 'Sektörel Çalışmalar',
        self::ETKINLIK             => 'Etkinlik ve Organizasyon',
        self::HEDEF_GERCEKLESTIRME => 'Hedef Gerçekleştirme',
        self::SINIFLANDIRILMAMIS   => 'Sınıflandırılmamış',
    ];

    /** Faaliyete atanabilecek kategoriler - "sınıflandırılmamış" seçilemez, yokluğu ifade eder. */
    public static function secilebilirler(): array
    {
        return array_values(array_diff(array_keys(self::ETIKETLER), [self::SINIFLANDIRILMAMIS]));
    }

    public static function etiket(?string $kategori): string
    {
        return self::ETIKETLER[$kategori ?? self::SINIFLANDIRILMAMIS] ?? self::ETIKETLER[self::SINIFLANDIRILMAMIS];
    }

    public static function anahtar(?string $kategori): string
    {
        return $kategori && isset(self::ETIKETLER[$kategori]) ? $kategori : self::SINIFLANDIRILMAMIS;
    }

    /**
     * Kategori toplamlarını rapor satırlarına çevirir.
     *
     * Sıralama bilerek tek yerde duruyor: dönem raporu, yıllık rapor ve şube
     * kırılımı aynı yapıyı üretiyor: üçü ayrı ayrı sıralarsa aynı görünen iki
     * liste ters yönde çıkar. Doküman bölüm 8 önce "geliştirilmesi gereken
     * konular"ı istediği için en zayıf kategori başta; güçlü yönler listenin
     * sonundan okunur.
     *
     * @param  array<string, array{puan:int, max_puan:int}>  $toplamlar
     * @return array<int, array{kategori:string, etiket:string, puan:int, max_puan:int, oran:float}>
     */
    public static function kirilim(array $toplamlar): array
    {
        $sonuc = [];

        foreach ($toplamlar as $anahtar => $t) {
            $sonuc[] = [
                'kategori' => $anahtar,
                'etiket'   => self::etiket($anahtar),
                'puan'     => $t['puan'],
                'max_puan' => $t['max_puan'],
                'oran'     => $t['max_puan'] > 0 ? round($t['puan'] / $t['max_puan'], 4) : 0.0,
            ];
        }

        usort($sonuc, fn ($a, $b) => $a['oran'] <=> $b['oran']);

        return $sonuc;
    }
}
