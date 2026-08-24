<?php

namespace App\Console\Commands;

use App\Models\Birim;
use App\Models\Sube;
use Illuminate\Console\Command;

/**
 * Birim kapsamı (BirimKapsami) şubelerin birim_id alanına dayanır. Sistem
 * kurulurken toplu içe aktarılan şubelerde bu alan boş kaldığı için birim
 * yöneticileri fiilen tüm şubeleri görüyordu. Bu komut boşta kalan şubeleri
 * bir birime bağlar.
 */
class SubeleriBirimeAta extends Command
{
    protected $signature = 'subeler:birime-ata
        {birim : Hedef birimin adı veya id\'si}
        {--filtre= : Yalnızca adı bu metni içeren şubeler}
        {--tumu : Birimi zaten atanmış şubeleri de taşı}
        {--uygula : Değişikliği yaz (varsayılan: yalnızca önizleme)}';

    protected $description = 'Birimi atanmamış şubeleri belirtilen birime bağlar';

    public function handle(): int
    {
        $birim = $this->birimiBul($this->argument('birim'));

        if (!$birim) {
            $this->error('Birim bulunamadı. Mevcut birimler: ' . Birim::pluck('name')->implode(', '));
            return self::FAILURE;
        }

        $query = Sube::query();

        if (!$this->option('tumu')) {
            $query->whereNull('birim_id');
        }

        if ($filtre = $this->option('filtre')) {
            $query->where('name', 'like', "%{$filtre}%");
        }

        $adet = (clone $query)->count();

        if ($adet === 0) {
            $this->info('Taşınacak şube bulunamadı.');
            return self::SUCCESS;
        }

        $this->line("Hedef birim : {$birim->name} (id {$birim->id})");
        $this->line("Şube sayısı : {$adet}");
        $this->line('Örnek       : ' . (clone $query)->orderBy('name')->limit(5)->pluck('name')->implode(', '));

        if (!$this->option('uygula')) {
            $this->newLine();
            $this->warn('Bu bir önizleme. Yazmak için --uygula ekleyin.');
            return self::SUCCESS;
        }

        $guncellenen = $query->update(['birim_id' => $birim->id]);

        $this->newLine();
        $this->info("{$guncellenen} şube '{$birim->name}' birimine bağlandı.");

        $kalan = Sube::whereNull('birim_id')->count();
        if ($kalan > 0) {
            $this->warn("{$kalan} şubenin birimi hâlâ boş - birim yöneticileri bu şubeleri göremeyecek.");
        }

        return self::SUCCESS;
    }

    private function birimiBul(string $girdi): ?Birim
    {
        return is_numeric($girdi)
            ? Birim::find((int) $girdi)
            : Birim::where('name', $girdi)->first();
    }
}
