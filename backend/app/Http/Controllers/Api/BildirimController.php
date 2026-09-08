<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Uygulama içi bildirimler.
 *
 * Kapsam kontrolü gerekmez: her uç yalnızca çağıran kullanıcının kendi
 * bildirimlerine erişir, hedef bildirim istekten değil oturumdan bulunur.
 */
class BildirimController extends Controller
{
    /** Çan ikonunun listesi - en yeniden eskiye, okunmamış sayısıyla. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // Çan yalnızca son bildirimleri gösterir; geçmişin tamamını taşımanın
        // bir faydası yok, aylar geçtikçe yanıt şişer.
        $bildirimler = $user->notifications()->latest()->limit(30)->get();

        return response()->json([
            'okunmamis' => $user->unreadNotifications()->count(),
            'liste'     => $bildirimler->map(fn ($b) => [
                'id'         => $b->id,
                'tur'        => $b->data['tur'] ?? null,
                'baslik'     => $b->data['baslik'] ?? '',
                'mesaj'      => $b->data['mesaj'] ?? '',
                'sayfa'      => $b->data['sayfa'] ?? null,
                'okundu'     => $b->read_at !== null,
                'created_at' => $b->created_at,
            ])->values(),
        ]);
    }

    /** Tek bildirimi okundu işaretler. */
    public function okundu(Request $request, string $bildirim): JsonResponse
    {
        $kayit = $request->user()->notifications()->whereKey($bildirim)->first();

        if (!$kayit) {
            abort(404, 'Bildirim bulunamadı.');
        }

        $kayit->markAsRead();

        return response()->json(['okunmamis' => $request->user()->unreadNotifications()->count()]);
    }

    /** Tümünü okundu işaretler. */
    public function tumunuOkundu(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications->markAsRead();

        return response()->json(['okunmamis' => 0]);
    }
}
