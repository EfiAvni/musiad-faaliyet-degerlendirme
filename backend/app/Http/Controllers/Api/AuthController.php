<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /** Aynı e-posta + IP için izin verilen ardışık hatalı deneme sayısı. */
    private const MAX_DENEME = 5;

    /** Limit aşıldığında uygulanan kilit süresi (saniye). */
    private const KILIT_SURESI = 900;

    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        $anahtar = $this->throttleAnahtari($request);

        if (RateLimiter::tooManyAttempts($anahtar, self::MAX_DENEME)) {
            $kalan = RateLimiter::availableIn($anahtar);

            throw ValidationException::withMessages([
                'email' => ["Çok fazla hatalı deneme yapıldı. {$this->sureMetni($kalan)} sonra tekrar deneyin."],
            ])->status(429);
        }

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            RateLimiter::hit($anahtar, self::KILIT_SURESI);

            Log::warning('Başarısız giriş denemesi', [
                'email' => $request->email,
                'ip'    => $request->ip(),
            ]);

            throw ValidationException::withMessages([
                'email' => ['E-posta veya parola hatalı.'],
            ]);
        }

        RateLimiter::clear($anahtar);

        // Her girişte önceki jetonları geçersiz kıl - eski cihazlarda kalan
        // jetonların süresiz geçerli kalmasını engeller.
        $user->tokens()->delete();

        return response()->json([
            'user'  => $this->userPayload($user),
            'token' => $user->createToken('api-token')->plainTextToken,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Çıkış yapıldı.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($this->userPayload($request->user()));
    }

    /**
     * İstemciye dönen tek kullanıcı gösterimi. Birim ve şube adları da burada
     * üretilir - arayüz bu etiketleri kendi tarafında türetmek zorunda kalmasın.
     */
    private function userPayload(User $user): array
    {
        $user->loadMissing(['birim:id,name', 'sube:id,name']);

        return [
            'id'        => $user->id,
            'name'      => $user->name,
            'email'     => $user->email,
            'role'      => $user->role,
            'birim_id'  => $user->birim_id,
            'sube_id'   => $user->sube_id,
            'birim_adi' => $user->birim?->name,
            'sube_adi'  => $user->sube?->name,
            'initials'  => $this->basHarfler($user->name),
        ];
    }

    /** Ad ve soyadın baş harfleri - ikinci adlar atlanır (Muhammet Avni Küçük → MK). */
    private function basHarfler(string $name): string
    {
        $parcalar = preg_split('/\s+/u', trim($name), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        if (!$parcalar) {
            return '?';
        }

        $secilen = count($parcalar) === 1
            ? [$parcalar[0]]
            : [$parcalar[0], end($parcalar)];

        return Str::upper(collect($secilen)
            ->map(fn (string $p) => Str::substr($p, 0, 1))
            ->implode(''));
    }

    private function throttleAnahtari(Request $request): string
    {
        return 'login:' . Str::lower((string) $request->input('email')) . '|' . $request->ip();
    }

    private function sureMetni(int $saniye): string
    {
        return $saniye >= 60
            ? ceil($saniye / 60) . ' dakika'
            : $saniye . ' saniye';
    }
}
