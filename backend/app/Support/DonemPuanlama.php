<?php

namespace App\Support;

use App\Models\Donem;
use App\Models\Faaliyet;
use App\Models\FaaliyetDegerlendirme;
use App\Models\FaaliyetKayit;
use App\Models\Sube;
use Illuminate\Support\Collection;

/**
 * Bir dönemin şube puanlarını hesaplar.
 *
 * Hem dönem raporu hem yıllık performans raporu buradan besleniyor: yıllık
 * rapor dönemleri tek tek bu servise sorup topluyor. Aksi halde puanlama
 * döngüsü üçüncü kez kopyalanacaktı.
 */
class DonemPuanlama
{
    /** @var Collection<int, Sube> */
    public Collection $subeler;

    /** @var Collection<int, Faaliyet> */
    public Collection $faaliyetler;

    /** [sube_id][faaliyet_id] => kayıt adedi */
    public array $adetMatrisi = [];

    /** [sube_id][faaliyet_id] => merkezin verdiği toplam puan */
    public array $manuelPuanlar = [];

    public int $maxPuanToplam = 0;

    /**
     * @param  int|null  $sadeceSubeId  Yalnızca bu şube hesaplansın. Şube kendi
     *   performansını sorarken 198 şubenin kaydını yüklemenin anlamı yok; sonuç
     *   aynı, çünkü puanlama şubeler arası bir bağ kurmuyor.
     */
    public function __construct(public Donem $donem, private ?int $sadeceSubeId = null)
    {
        $this->hazirla();
    }

    /** @var Collection<int, FaaliyetKayit> */
    public Collection $kayitlar;

    private function hazirla(): void
    {
        $this->faaliyetler = Faaliyet::where('donem_id', $this->donem->id)->degerlendirmeye()->get();
        $this->maxPuanToplam = (int) $this->faaliyetler->sum(fn (Faaliyet $f) => $f->max_puan);

        $faaliyetIds = $this->faaliyetler->pluck('id');

        $this->subeler = $this->subeleriTopla($faaliyetIds);

        $this->kayitlar = FaaliyetKayit::whereIn('faaliyet_id', $faaliyetIds)
            ->whereIn('sube_id', $this->subeler->pluck('id'))
            ->get(['id', 'faaliyet_id', 'sube_id', 'donem_ay_id']);

        foreach ($this->kayitlar as $k) {
            $this->adetMatrisi[$k->sube_id][$k->faaliyet_id] = ($this->adetMatrisi[$k->sube_id][$k->faaliyet_id] ?? 0) + 1;
        }

        $this->manuelPuanlar = $this->manuelPuanlariTopla($faaliyetIds);
    }

    /**
     * Dönemin şubeleri: kapsamdaki aktif şubeler ile döneme kaydı girilmiş
     * şubelerin birleşimi.
     *
     * Yalnızca aktif şubeleri almak, dönem ortasında pasife alınan bir şubeyi
     * raporun tamamından siliyordu: girdiği kayıtlar duruyor ama ne satırı ne
     * puanı görünüyor, dönem ortalaması da o şube hiç yokmuş gibi çıkıyordu.
     * Aynı sebeple şube, pasife alındıktan sonra da kendi geçmiş performansını
     * görebilmelidir - bu yüzden sadeceSubeId filtresi birleşimin üstüne biner.
     *
     * Filtre dönem kapsamının yerine geçmez: kapsamda olmayan ve döneme kaydı
     * bulunmayan bir şube id'si verilirse liste boş döner, sessizce kapsam
     * açılmaz.
     *
     * @return Collection<int, Sube>
     */
    private function subeleriTopla($faaliyetIds): Collection
    {
        $kapsamQuery = $this->donem->tum_subeler ? Sube::query() : $this->donem->subeler();

        // uye_sayisi oran tipi kriterlerde gerekli.
        $alanlar = ['subeler.id', 'subeler.name', 'subeler.uye_sayisi'];

        $kapsam = (clone $kapsamQuery)
            ->where('subeler.status', 'active')
            ->when($this->sadeceSubeId !== null, fn ($q) => $q->where('subeler.id', $this->sadeceSubeId))
            ->get($alanlar);

        // Tek şube sorulduğunda 198 şubenin kaydını taramanın anlamı yok.
        $kayitliIds = FaaliyetKayit::whereIn('faaliyet_id', $faaliyetIds)
            ->when($this->sadeceSubeId !== null, fn ($q) => $q->where('sube_id', $this->sadeceSubeId))
            ->distinct()
            ->pluck('sube_id');

        $eksikIds = $kayitliIds->diff($kapsam->pluck('id'));

        $eksikler = $eksikIds->isEmpty()
            ? collect()
            : Sube::whereIn('subeler.id', $eksikIds)->get($alanlar);

        return $kapsam->concat($eksikler)->sortBy('name')->values();
    }

    /**
     * Oran tipi kriter varken üye sayısı girilmemiş şubeler.
     *
     * Üye sayısı bilinmeyen şubede oransal kriterler sessizce sıfır puan
     * üretiyordu; rapor bunu artık uyarı olarak gösteriyor.
     *
     * @return array<int, array{sube_id:int, sube_adi:string}>
     */
    public function uyeSayisiEksikSubeler(): array
    {
        $oranVarMi = $this->faaliyetler->contains(
            fn (Faaliyet $f) => $f->kriter_turu === PuanHesaplayici::ORAN
        );

        if (!$oranVarMi) {
            return [];
        }

        return $this->subeler
            ->filter(fn (Sube $s) => (int) $s->uye_sayisi <= 0)
            ->map(fn (Sube $s) => ['sube_id' => $s->id, 'sube_adi' => $s->name])
            ->values()
            ->all();
    }

    /** Bir şubenin bir faaliyetten aldığı puan. */
    public function faaliyetPuani(Sube $sube, Faaliyet $faaliyet): int
    {
        return PuanHesaplayici::puan(
            $faaliyet,
            $this->adetMatrisi[$sube->id][$faaliyet->id] ?? 0,
            $sube->uye_sayisi,
            $this->manuelPuanlar[$sube->id][$faaliyet->id] ?? null,
        );
    }

    public function subeToplamPuani(Sube $sube): int
    {
        $toplam = 0;
        foreach ($this->faaliyetler as $f) {
            $toplam += $this->faaliyetPuani($sube, $f);
        }

        return $toplam;
    }

    /** Şubenin bu dönemde girdiği toplam kayıt adedi. */
    public function subeKayitSayisi(Sube $sube): int
    {
        return (int) array_sum($this->adetMatrisi[$sube->id] ?? []);
    }

    /** Bir faaliyetin bir şubeden aldığı kayıt adedi. */
    public function adet(Sube $sube, Faaliyet $faaliyet): int
    {
        return (int) ($this->adetMatrisi[$sube->id][$faaliyet->id] ?? 0);
    }

    /**
     * Doküman bölüm 7-8: şubenin hangi konuda başarılı, hangi konuda eksik
     * olduğunu gösteren kategori kırılımı.
     *
     * @return array<int, array{kategori:string, etiket:string, puan:int, max_puan:int, oran:float}>
     */
    public function kategoriKirilimi(Sube $sube): array
    {
        $toplamlar = [];

        foreach ($this->faaliyetler as $f) {
            $anahtar = KriterKategorileri::anahtar($f->kategori);

            if (!isset($toplamlar[$anahtar])) {
                $toplamlar[$anahtar] = ['puan' => 0, 'max_puan' => 0];
            }

            $toplamlar[$anahtar]['puan'] += $this->faaliyetPuani($sube, $f);
            $toplamlar[$anahtar]['max_puan'] += $f->max_puan;
        }

        return KriterKategorileri::kirilim($toplamlar);
    }

    /** @return array<int, array<int, int>> */
    private function manuelPuanlariTopla($faaliyetIds): array
    {
        $satirlar = FaaliyetDegerlendirme::query()
            ->join('ay_gonderimleri', 'ay_gonderimleri.id', '=', 'faaliyet_degerlendirmeleri.ay_gonderim_id')
            ->join('donem_aylar', 'donem_aylar.id', '=', 'ay_gonderimleri.donem_ay_id')
            ->where('donem_aylar.donem_id', $this->donem->id)
            ->whereNull('ay_gonderimleri.deleted_at')
            ->whereIn('faaliyet_degerlendirmeleri.faaliyet_id', $faaliyetIds)
            ->when($this->sadeceSubeId !== null, fn ($q) => $q->where('ay_gonderimleri.sube_id', $this->sadeceSubeId))
            ->groupBy('ay_gonderimleri.sube_id', 'faaliyet_degerlendirmeleri.faaliyet_id')
            ->selectRaw('ay_gonderimleri.sube_id, faaliyet_degerlendirmeleri.faaliyet_id, SUM(faaliyet_degerlendirmeleri.puan) as toplam')
            ->get();

        $harita = [];
        foreach ($satirlar as $satir) {
            $harita[(int) $satir->sube_id][(int) $satir->faaliyet_id] = (int) $satir->toplam;
        }

        return $harita;
    }
}
