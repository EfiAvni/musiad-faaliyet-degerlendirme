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

    public function __construct(public Donem $donem)
    {
        $this->hazirla();
    }

    private function hazirla(): void
    {
        $subeQuery = $this->donem->tum_subeler ? Sube::query() : $this->donem->subeler();

        // uye_sayisi oran tipi kriterlerde gerekli.
        $this->subeler = $subeQuery->where('subeler.status', 'active')
            ->orderBy('subeler.name')
            ->get(['subeler.id', 'subeler.name', 'subeler.uye_sayisi']);

        $this->faaliyetler = Faaliyet::where('donem_id', $this->donem->id)->get();
        $this->maxPuanToplam = (int) $this->faaliyetler->sum(fn (Faaliyet $f) => $f->max_puan);

        $faaliyetIds = $this->faaliyetler->pluck('id');

        $kayitlar = FaaliyetKayit::whereIn('faaliyet_id', $faaliyetIds)
            ->whereIn('sube_id', $this->subeler->pluck('id'))
            ->get(['id', 'faaliyet_id', 'sube_id', 'donem_ay_id']);

        foreach ($kayitlar as $k) {
            $this->adetMatrisi[$k->sube_id][$k->faaliyet_id] = ($this->adetMatrisi[$k->sube_id][$k->faaliyet_id] ?? 0) + 1;
        }

        $this->manuelPuanlar = $this->manuelPuanlariTopla($faaliyetIds);
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
