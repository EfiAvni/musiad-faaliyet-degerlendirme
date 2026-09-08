<?php

namespace App\Notifications;

use App\Models\AyGonderim;
use App\Models\Donem;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Uygulama içi bildirim.
 *
 * Dört olay iki yönde akar: şube ayı gönderir (şube → merkez), merkez onaylar
 * veya düzeltme ister (merkez → şube), merkez yeni dönem açar (merkez → şube).
 * Her biri karşı tarafın harekete geçmesi gereken bir andır; ara adımlar
 * (tek tek manuel puanlama gibi) bilerek bildirim üretmez, yoksa çan
 * gürültüye boğulur ve okunmaz hale gelir.
 *
 * Yalnızca database kanalı kullanılır - e-posta gönderimi yok. Mail kanalı
 * ileride eklenirse burada toMail() tanımlamak yeterli.
 */
class SistemBildirimi extends Notification
{
    use Queueable;

    public const AY_GONDERILDI = 'ay_gonderildi';
    public const ONAYLANDI = 'onaylandi';
    public const DUZELTME_ISTENDI = 'duzeltme_istendi';
    public const DONEM_ACILDI = 'donem_acildi';

    private function __construct(
        public string $tur,
        public string $baslik,
        public string $mesaj,
        /** Bildirime tıklayınca açılacak sayfa. */
        public string $sayfa,
        public array $ek = [],
    ) {
    }

    /** Şube ayını merkeze gönderdi. */
    public static function ayGonderildi(AyGonderim $gonderim): self
    {
        $sube = $gonderim->sube?->name ?? 'Şube';
        $ay = $gonderim->donemAy?->name ?? 'Ay';

        return new self(
            self::AY_GONDERILDI,
            'Yeni gönderim: ' . $sube,
            "{$sube}, {$ay} ayını incelemeniz için gönderdi.",
            'gonderimler',
            ['gonderim_id' => $gonderim->id, 'sube_id' => $gonderim->sube_id],
        );
    }

    /** Merkez ayı onayladı. */
    public static function onaylandi(AyGonderim $gonderim): self
    {
        $ay = $gonderim->donemAy?->name ?? 'Ay';

        return new self(
            self::ONAYLANDI,
            'Gönderiminiz onaylandı',
            "{$ay} ayı merkez tarafından onaylandı. Bu ayda artık değişiklik yapılamaz.",
            'faaliyetlerim',
            ['gonderim_id' => $gonderim->id],
        );
    }

    /** Merkez düzeltme istedi - akışın en kritik bildirimi. */
    public static function duzeltmeIstendi(AyGonderim $gonderim): self
    {
        $ay = $gonderim->donemAy?->name ?? 'Ay';
        $not = trim((string) $gonderim->merkez_notu);

        return new self(
            self::DUZELTME_ISTENDI,
            'Düzeltme bekleniyor: ' . $ay,
            $not !== ''
                ? "{$ay} ayı için merkez düzeltme istedi: {$not}"
                : "{$ay} ayı için merkez düzeltme istedi.",
            'faaliyetlerim',
            ['gonderim_id' => $gonderim->id],
        );
    }

    /** Yeni dönem aktifleştirildi, şube kayıt girebilir. */
    public static function donemAcildi(Donem $donem): self
    {
        return new self(
            self::DONEM_ACILDI,
            'Yeni dönem açıldı',
            "{$donem->name} dönemi başladı, faaliyet kaydı girebilirsiniz.",
            'faaliyetlerim',
            ['donem_id' => $donem->id],
        );
    }

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'tur'    => $this->tur,
            'baslik' => $this->baslik,
            'mesaj'  => $this->mesaj,
            'sayfa'  => $this->sayfa,
        ] + $this->ek;
    }
}
