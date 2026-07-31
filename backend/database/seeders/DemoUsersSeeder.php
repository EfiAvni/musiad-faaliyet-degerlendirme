<?php

namespace Database\Seeders;

use App\Models\Birim;
use App\Models\Sube;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoUsersSeeder extends Seeder
{
    public function run(): void
    {
        // Birim oluştur
        $birim = Birim::firstOrCreate(
            ['name' => 'Teşkilatlanma'],
            ['status' => 'active', 'created_year' => 2020]
        );

        // Şube oluştur
        $sube = Sube::firstOrCreate(
            ['name' => 'Ankara Şubesi'],
            ['birim_id' => $birim->id, 'uye_sayisi' => 0, 'status' => 'active']
        );

        // Süper Admin
        $superadmin = User::updateOrCreate(
            ['email' => 'avni.kucuk@musiad.org.tr'],
            [
                'name'     => 'Muhammet Avni Küçük',
                'password' => Hash::make('admin123'),
                'role'     => 'superadmin',
            ]
        );

        // Birim Yöneticisi
        $birimYoneticisi = User::updateOrCreate(
            ['email' => 'huseyin.ozer@musiad.org.tr'],
            [
                'name'     => 'Hüseyin Özer',
                'password' => Hash::make('birim123'),
                'role'     => 'birim_yoneticisi',
                'birim_id' => $birim->id,
            ]
        );

        // Birimin yöneticisini güncelle
        $birim->update(['yonetici_id' => $birimYoneticisi->id]);

        // Şube Yöneticisi
        $subeYoneticisi = User::updateOrCreate(
            ['email' => 'ankara@musiad.org.tr'],
            [
                'name'     => 'Ankara Şubesi Yöneticisi',
                'password' => Hash::make('sube123'),
                'role'     => 'sube_yoneticisi',
                'birim_id' => $birim->id,
                'sube_id'  => $sube->id,
            ]
        );

        // Şubenin yöneticisini güncelle
        $sube->update(['yonetici_id' => $subeYoneticisi->id]);

        $this->command->info('Demo kullanıcılar oluşturuldu:');
        $this->command->info('  Süper Admin  : avni.kucuk@musiad.org.tr / admin123');
        $this->command->info('  Birim Yön.   : huseyin.ozer@musiad.org.tr / birim123');
        $this->command->info('  Şube Yön.    : ankara@musiad.org.tr / sube123');
    }
}
