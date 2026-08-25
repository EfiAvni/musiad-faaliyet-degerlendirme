<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::with(['birim:id,name', 'sube:id,name']);

        if ($request->filled('search')) {
            $arama = $request->string('search')->toString();
            $query->where(function ($q) use ($arama) {
                $q->where('name', 'like', "%{$arama}%")
                  ->orWhere('email', 'like', "%{$arama}%");
            });
        }

        return response()->json(
            UserResource::collection($query->orderByDesc('id')->get())
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8',
            'role'     => ['required', Rule::in(User::ROLLER)],
            'birim_id' => 'nullable|exists:birimler,id',
            'sube_id'  => 'nullable|exists:subeler,id',
        ]);

        $this->assertKapsamGecerli($data['role'], $data['birim_id'] ?? null, $data['sube_id'] ?? null);

        $data['password'] = Hash::make($data['password']);
        $data = $this->kapsamiRoleGoreTemizle($data);

        return response()->json(new UserResource(User::create($data)), 201);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json(new UserResource($user));
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name'     => 'sometimes|required|string|max:255',
            'email'    => ['sometimes', 'required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'password' => 'nullable|string|min:8',
            'role'     => ['sometimes', 'required', Rule::in(User::ROLLER)],
            'birim_id' => 'nullable|exists:birimler,id',
            'sube_id'  => 'nullable|exists:subeler,id',
        ]);

        $rol = $data['role'] ?? $user->role;
        $birimId = array_key_exists('birim_id', $data) ? $data['birim_id'] : $user->birim_id;
        $subeId = array_key_exists('sube_id', $data) ? $data['sube_id'] : $user->sube_id;

        $this->assertKapsamGecerli($rol, $birimId, $subeId);

        // Sistemde yetki verebilecek kimse kalmamasını engeller.
        if ($user->role === 'superadmin' && $rol !== 'superadmin' && $this->digerSuperadminSayisi($user) === 0) {
            throw ValidationException::withMessages([
                'role' => 'Sistemdeki son süper admin başka bir role taşınamaz. Önce başka bir süper admin tanımlayın.',
            ]);
        }

        $parolaDegisti = !empty($data['password']);

        if ($parolaDegisti) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        $data['role'] = $rol;
        $data['birim_id'] = $birimId;
        $data['sube_id'] = $subeId;

        $user->update($this->kapsamiRoleGoreTemizle($data));

        if ($parolaDegisti) {
            $this->oturumlariKapat($user, $request);
        }

        return response()->json(new UserResource($user->fresh()));
    }

    /**
     * Parola değişince kullanıcının açık oturumları da kapanmalı - aksi halde
     * sıfırlama, ele geçirilmiş bir oturumu geçersiz kılmaz.
     *
     * İşlemi yapan kişi kendi parolasını değiştiriyorsa o anki jetonu ayakta
     * bırakılır; aksi halde admin kendini uygulamadan atmış olur.
     */
    private function oturumlariKapat(User $user, Request $request): void
    {
        $query = $user->tokens();

        if ($request->user()->is($user)) {
            // currentAccessToken() her zaman kalıcı bir jeton olmayabilir
            // (ör. test ortamındaki TransientToken); anahtarı yoksa hariç
            // tutacak bir şey de yok demektir.
            $mevcutJetonId = $request->user()->currentAccessToken()?->getKey();

            if ($mevcutJetonId !== null) {
                $query->whereKeyNot($mevcutJetonId);
            }
        }

        $query->delete();
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($request->user()->id === $user->id) {
            throw ValidationException::withMessages([
                'user_id' => 'Kendi hesabınızı silemezsiniz.',
            ]);
        }

        if ($user->role === 'superadmin' && $this->digerSuperadminSayisi($user) === 0) {
            throw ValidationException::withMessages([
                'user_id' => 'Sistemdeki son süper admin silinemez. Önce başka bir süper admin tanımlayın.',
            ]);
        }

        // Kullanıcı yumuşak silinir (girdiği faaliyet kayıtlarının sahipliği
        // korunsun diye), ama açık oturumları hemen kapatılır.
        $user->tokens()->delete();
        $user->delete();

        return response()->json(null, 204);
    }

    /** Rolün gerektirdiği birim/şube ataması yapılmış mı? */
    private function assertKapsamGecerli(string $rol, ?int $birimId, ?int $subeId): void
    {
        if ($rol === 'birim_yoneticisi' && !$birimId) {
            throw ValidationException::withMessages([
                'birim_id' => 'Birim yöneticisi için birim seçimi zorunludur.',
            ]);
        }

        if ($rol === 'sube_yoneticisi' && !$subeId) {
            throw ValidationException::withMessages([
                'sube_id' => 'Şube yöneticisi için şube seçimi zorunludur.',
            ]);
        }
    }

    /**
     * Role uymayan kapsam alanlarını temizler - örneğin şube yöneticisiyken
     * birim yöneticisine çevrilen bir kullanıcıda eski sube_id kalmasın.
     */
    private function kapsamiRoleGoreTemizle(array $data): array
    {
        if (($data['role'] ?? null) === 'superadmin') {
            $data['birim_id'] = null;
            $data['sube_id'] = null;
        }

        if (($data['role'] ?? null) === 'birim_yoneticisi') {
            $data['sube_id'] = null;
        }

        return $data;
    }

    private function digerSuperadminSayisi(User $haric): int
    {
        return User::where('role', 'superadmin')->whereKeyNot($haric->id)->count();
    }
}
