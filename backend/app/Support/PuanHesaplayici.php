<?php

namespace App\Support;

use App\Models\Faaliyet;

/**
 * Bir faaliyetin bir şube için kaç puan getirdiğini hesaplar.
 *
 * Gereksinim dokümanı bölüm 6 farklı kriter türleri istiyor; hepsi burada
 * toplanır. Önceden bu hesap rapor ve şube puan özeti olmak üzere iki yerde
 * kopyalanmıştı - tek kaynak olması, bir tür eklendiğinde iki yerin
 * ayrışmasını engeller.
 */
class PuanHesaplayici
{
    public const SAYI = 'sayi';
    public const EVET_HAYIR = 'evet_hayir';
    public const ORAN = 'oran';
    public const KADEMELI = 'kademeli';
    public const MANUEL = 'manuel';

    public const TURLER = [self::SAYI, self::EVET_HAYIR, self::ORAN, self::KADEMELI, self::MANUEL];

    /** Merkezin elle puanladığı türler otomatik hesaplanamaz. */
    public static function manuelMi(Faaliyet $faaliyet): bool
    {
        return $faaliyet->kriter_turu === self::MANUEL;
    }

    /**
     * @param  int       $adet         Şubenin bu faaliyete girdiği kayıt sayısı
     * @param  int|null  $uyeSayisi    Oran tipi kriterler için şubenin üye sayısı
     * @param  int|null  $manuelPuan   Merkezin verdiği puan (yalnızca manuel türde)
     */
    public static function puan(Faaliyet $faaliyet, int $adet, ?int $uyeSayisi = null, ?int $manuelPuan = null): int
    {
        return match ($faaliyet->kriter_turu) {
            self::EVET_HAYIR => $adet > 0 ? (int) $faaliyet->puan : 0,
            self::ORAN       => self::oranPuani($faaliyet, $adet, $uyeSayisi),
            self::KADEMELI   => self::kademePuani($faaliyet, $adet),
            self::MANUEL     => min((int) ($manuelPuan ?? 0), self::maxPuan($faaliyet)),
            default          => min($adet * (int) $faaliyet->puan, self::maxPuan($faaliyet)),
        };
    }

    /** Faaliyetten alınabilecek en yüksek puan - tamamlanma oranlarının paydası. */
    public static function maxPuan(Faaliyet $faaliyet): int
    {
        return match ($faaliyet->kriter_turu) {
            // Yapıldı/yapılmadı: hedef anlamsız, tam puan ya alınır ya alınmaz.
            self::EVET_HAYIR, self::ORAN, self::MANUEL => (int) $faaliyet->puan,
            self::KADEMELI => self::enYuksekKademePuani($faaliyet),
            default => (int) $faaliyet->puan * (int) $faaliyet->hedef,
        };
    }

    /**
     * Şube büyüklüğüne göre normalize eder: küçük şubenin 5 ziyareti ile büyük
     * şubenin 5 ziyareti aynı başarı değildir. hedef alanı burada yüzde
     * anlamına gelir (hedef=20 → üyelerin %20'sine ulaşılmalı).
     */
    private static function oranPuani(Faaliyet $faaliyet, int $adet, ?int $uyeSayisi): int
    {
        $hedefYuzde = (int) $faaliyet->hedef;

        // Üye sayısı bilinmiyorsa oran hesaplanamaz; puan verilmez.
        if (!$uyeSayisi || $uyeSayisi <= 0 || $hedefYuzde <= 0) {
            return 0;
        }

        $gerceklesenYuzde = $adet / $uyeSayisi * 100;
        $doluluk = min($gerceklesenYuzde / $hedefYuzde, 1);

        return (int) round($doluluk * (int) $faaliyet->puan);
    }

    /** Eşiği geçilen en yüksek kademenin puanı. */
    private static function kademePuani(Faaliyet $faaliyet, int $adet): int
    {
        $puan = 0;

        foreach (self::kademeler($faaliyet) as $kademe) {
            if ($adet >= $kademe['esik']) {
                $puan = max($puan, $kademe['puan']);
            }
        }

        return $puan;
    }

    private static function enYuksekKademePuani(Faaliyet $faaliyet): int
    {
        $puanlar = array_column(self::kademeler($faaliyet), 'puan');

        return $puanlar ? max($puanlar) : 0;
    }

    /** @return array<int, array{esik:int, puan:int}> */
    private static function kademeler(Faaliyet $faaliyet): array
    {
        $ham = $faaliyet->kademeler;

        if (!is_array($ham)) {
            return [];
        }

        $temiz = [];
        foreach ($ham as $kademe) {
            if (isset($kademe['esik'], $kademe['puan'])) {
                $temiz[] = ['esik' => (int) $kademe['esik'], 'puan' => (int) $kademe['puan']];
            }
        }

        return $temiz;
    }
}
