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
     * @param  float     $donemOrani   Raporlanan ay aralığının dönemin kaçta kaçı
     *                                 olduğu (1.0 = dönemin tamamı). Bkz. hedef().
     */
    public static function puan(
        Faaliyet $faaliyet,
        int $adet,
        ?int $uyeSayisi = null,
        ?int $manuelPuan = null,
        float $donemOrani = 1.0,
    ): int {
        return match ($faaliyet->kriter_turu) {
            self::EVET_HAYIR => $adet > 0 ? (int) $faaliyet->puan : 0,
            self::ORAN       => self::oranPuani($faaliyet, $adet, $uyeSayisi, $donemOrani),
            self::KADEMELI   => self::kademePuani($faaliyet, $adet, $donemOrani),
            self::MANUEL     => min((int) ($manuelPuan ?? 0), self::maxPuan($faaliyet)),
            default          => min($adet * (int) $faaliyet->puan, self::maxPuan($faaliyet, $donemOrani)),
        };
    }

    /** Faaliyetten alınabilecek en yüksek puan - tamamlanma oranlarının paydası. */
    public static function maxPuan(Faaliyet $faaliyet, float $donemOrani = 1.0): int
    {
        return match ($faaliyet->kriter_turu) {
            // Yapıldı/yapılmadı: hedef anlamsız, tam puan ya alınır ya alınmaz.
            self::EVET_HAYIR, self::ORAN, self::MANUEL => (int) $faaliyet->puan,
            self::KADEMELI => self::enYuksekKademePuani($faaliyet),
            default => (int) $faaliyet->puan * self::hedef($faaliyet, $donemOrani),
        };
    }

    /**
     * Ay aralığına göre orantılanmış hedef.
     *
     * Rapor bir ay aralığıyla sınırlandığında dönemin tamamı için konmuş hedefi
     * payda tutmak yanıltıcı olur: 12 aylık dönemde hedefi 12 olan bir kriterde
     * Mart-Temmuz arası 5 kayıt girmiş şube, tam hedefe göre %42 görünür ama
     * o beş ayda beklenen zaten 5'tir. Sayım tabanlı ölçüler (sayı, kademeli
     * eşikleri, oran yüzdesi) ay sayısıyla orantılanır.
     *
     * Evet/hayır ve manuel türlerde tavan zaten aya bağlı değildir: biri "yapıldı
     * mı" sorusudur, diğerinde puanı merkez verir. Onlar orantılanmaz.
     */
    public static function hedef(Faaliyet $faaliyet, float $donemOrani = 1.0): int
    {
        return self::orantila((int) $faaliyet->hedef, $donemOrani);
    }

    /** Sıfırdan büyük bir hedef orantılandığında sıfıra düşmemeli. */
    private static function orantila(int $deger, float $donemOrani): int
    {
        if ($deger <= 0 || $donemOrani >= 1.0) {
            return $deger;
        }

        return max(1, (int) round($deger * $donemOrani));
    }

    /**
     * Şube büyüklüğüne göre normalize eder: küçük şubenin 5 ziyareti ile büyük
     * şubenin 5 ziyareti aynı başarı değildir. hedef alanı burada yüzde
     * anlamına gelir (hedef=20 → üyelerin %20'sine ulaşılmalı).
     */
    private static function oranPuani(Faaliyet $faaliyet, int $adet, ?int $uyeSayisi, float $donemOrani = 1.0): int
    {
        // Beş ayda üyelerin %20'sine ulaşmak on iki ayda ulaşmakla aynı iş
        // değil; hedef yüzdesi de ay sayısıyla orantılanır.
        $hedefYuzde = self::hedef($faaliyet, $donemOrani);

        // Üye sayısı bilinmiyorsa oran hesaplanamaz; puan verilmez.
        if (!$uyeSayisi || $uyeSayisi <= 0 || $hedefYuzde <= 0) {
            return 0;
        }

        $gerceklesenYuzde = $adet / $uyeSayisi * 100;
        $doluluk = min($gerceklesenYuzde / $hedefYuzde, 1);

        return (int) round($doluluk * (int) $faaliyet->puan);
    }

    /** Eşiği geçilen en yüksek kademenin puanı. */
    private static function kademePuani(Faaliyet $faaliyet, int $adet, float $donemOrani = 1.0): int
    {
        $puan = 0;

        foreach (self::kademeler($faaliyet) as $kademe) {
            // Eşikler de sayım tabanlıdır; kısa aralıkta orantılanır.
            if ($adet >= self::orantila($kademe['esik'], $donemOrani)) {
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
