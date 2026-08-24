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

    'max_age' => 0,

    'supports_credentials' => false,

];
