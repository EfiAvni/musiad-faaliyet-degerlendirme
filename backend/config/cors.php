<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS)
    |--------------------------------------------------------------------------
    |
    | İzinli kaynaklar CORS_ALLOWED_ORIGINS ortam değişkeninden virgülle ayrılmış
    | olarak okunur. Değişken tanımlı değilse liste boş kalır - böylece canlı
    | ortamda değişken unutulursa API dışarıya açılmaz.
    |
    | Yerelde ayrıca tüm localhost portları kabul edilir: geliştirme sunucusunun
    | portu değiştiğinde CORS'un sessizce kırılmasını engeller. Bu kural yalnızca
    | production dışı ortamlarda geçerlidir.
    |
    */

    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('CORS_ALLOWED_ORIGINS', ''))
    ))),

    'allowed_origins_patterns' => env('APP_ENV') === 'production'
        ? []
        : ['#^http://(localhost|127\.0\.0\.1)(:\d+)?$#'],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    /*
     * Preflight (OPTIONS) yanıtının tarayıcıda ne kadar saklanacağı.
     *
     * Sıfırken tarayıcı her API çağrısından önce ayrı bir OPTIONS isteği atar:
     * arayüz jeton başlığı gönderdiği için istekler "basit" sayılmaz ve her
     * biri iki tura çıkar. Bir gün saklamak ilk çağrıdan sonra bu turu ortadan
     * kaldırır. Değer CORS ayarları değiştiğinde tarayıcının ne kadar geç
     * haberdar olacağını da belirler; bu ayarlar dağıtımla değiştiği için bir
     * gün güvenli bir aralık.
     */
    'max_age' => (int) env('CORS_MAX_AGE', 86400),

    'supports_credentials' => false,

];
