<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BirimController;
use App\Http\Controllers\Api\DonemController;
use App\Http\Controllers\Api\FaaliyetController;
use App\Http\Controllers\Api\FaaliyetKayitController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SubeController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

// Public routes
// Controller içinde e-posta+IP bazlı kilit var; buradaki throttle ise tek bir
// IP'nin farklı e-postaları tarayarak limiti aşmasını engelleyen ikinci katman.
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:20,1');

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    // Süper Admin
    Route::middleware('role:superadmin')->group(function () {
        Route::apiResource('birimler', BirimController::class);
        Route::apiResource('users', UserController::class);
    });

    // Okuma: tüm giriş yapmış roller (şube tarafı da dönem/faaliyet bilgisine ihtiyaç duyar)
    Route::apiResource('subeler', SubeController::class)->only(['index', 'show'])->parameters(['subeler' => 'sube']);
    Route::apiResource('donemler', DonemController::class)->only(['index', 'show'])->parameters(['donemler' => 'donem']);
    Route::apiResource('faaliyetler', FaaliyetController::class)->only(['index', 'show'])->parameters(['faaliyetler' => 'faaliyet']);

    // Yazma: Süper Admin + Birim Yöneticisi
    Route::middleware('role:superadmin,birim_yoneticisi')->group(function () {
        // Import önce tanımlanmalı — yoksa {sube} parametresi yakalar
        Route::post('/subeler/import', [SubeController::class, 'import']);
        Route::apiResource('subeler', SubeController::class)->only(['store', 'update', 'destroy'])->parameters(['subeler' => 'sube']);

        // activate/complete önce tanımlanmalı — yoksa {donem} parametresi yakalar
        Route::post('/donemler/{donem}/activate', [DonemController::class, 'activate']);
        Route::post('/donemler/{donem}/complete', [DonemController::class, 'complete']);
        Route::apiResource('donemler', DonemController::class)->only(['store', 'update', 'destroy'])->parameters(['donemler' => 'donem']);
        Route::patch('/donem-aylar/{ay}', [DonemController::class, 'updateAy']);

        Route::apiResource('faaliyetler', FaaliyetController::class)->only(['store', 'update', 'destroy'])->parameters(['faaliyetler' => 'faaliyet']);

        Route::get('/subeler/{sube}/puan-ozeti', [SubeController::class, 'puanOzeti']);

        Route::get('/raporlar/{donem}', [ReportController::class, 'show']);
        Route::get('/raporlar/{donem}/pdf', [ReportController::class, 'pdf']);
    });

    // Şube faaliyet kayıtları: yetki/kapsam kontrolü controller içinde (rol + kendi şubesi)
    Route::apiResource('faaliyet-kayitlari', FaaliyetKayitController::class)
        ->only(['index', 'store', 'update', 'destroy'])
        ->parameters(['faaliyet-kayitlari' => 'kayit']);
});
