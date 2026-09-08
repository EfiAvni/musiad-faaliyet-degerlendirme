<?php

return [

    /*
    |--------------------------------------------------------------------------
    | HSTS
    |--------------------------------------------------------------------------
    |
    | Tarayıcıya "bu alan adına bir daha http ile bağlanma" der. Yalnızca https
    | isteklerinde gönderilir.
    |
    | Dikkat: tarayıcı bu talimatı süre boyunca hatırlar. Alan adında henüz
    | https'e geçmemiş bir alt alan varsa includeSubDomains onu da erişilemez
    | kılar. Bu yüzden alt alan kapsamı varsayılan olarak kapalı.
    |
    */

    'hsts' => [
        'aktif'       => (bool) env('HSTS_AKTIF', true),
        'sure'        => (int) env('HSTS_SURE', 31536000),
        'alt_alanlar' => (bool) env('HSTS_ALT_ALANLAR', false),
    ],

    /*
    |--------------------------------------------------------------------------
    | Hız sınırları (dakika başına istek)
    |--------------------------------------------------------------------------
    |
    | Giriş ekranının kendi kilidi ayrıdır (AuthController). Buradakiler
    | kimliği doğrulanmış kullanıcılar içindir: amaç kötü niyeti durdurmak
    | değil, tek bir hesabın sistemi meşgul etmesini engellemek.
    |
    | Raporlar ayrı ve daha dar bir sınırla korunur: en pahalı uçlar onlar,
    | tek bir yıllık rapor isteği yüz milisaniyelerce sunucu zamanı harcar.
    |
    */

    'limit' => [
        'genel'   => (int) env('HIZ_LIMITI_GENEL', 120),
        'raporlar' => (int) env('HIZ_LIMITI_RAPORLAR', 20),
    ],

];
