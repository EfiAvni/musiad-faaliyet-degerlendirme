<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::with(['birim', 'sube']);

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        return response()->json($query->orderBy('id', 'desc')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:6',
            'role'     => ['required', Rule::in(['superadmin', 'birim_yoneticisi', 'sube_yoneticisi'])],
            'birim_id' => 'nullable|exists:birimler,id',
            'sube_id'  => 'nullable|exists:subeler,id',
        ]);

        $validated['password'] = Hash::make($validated['password']);

        // İlgili roller için birim/şube kontrolleri
        if ($validated['role'] === 'birim_yoneticisi' && empty($validated['birim_id'])) {
            return response()->json(['message' => 'Birim yöneticisi için birim seçimi zorunludur.'], 422);
        }

        if ($validated['role'] === 'sube_yoneticisi' && empty($validated['sube_id'])) {
            return response()->json(['message' => 'Şube yöneticisi için şube seçimi zorunludur.'], 422);
        }

        $user = User::create($validated);
        $user->load(['birim', 'sube']);

        return response()->json($user, 201);
    }

    public function show(User $user)
    {
        return response()->json($user->load(['birim', 'sube']));
    }

    public function update(Request $request, User $user)
    {
        $validated = $request->validate([
            'name'     => 'sometimes|required|string|max:255',
            'email'    => ['sometimes', 'required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'password' => 'nullable|string|min:6',
            'role'     => ['sometimes', 'required', Rule::in(['superadmin', 'birim_yoneticisi', 'sube_yoneticisi'])],
            'birim_id' => 'nullable|exists:birimler,id',
            'sube_id'  => 'nullable|exists:subeler,id',
        ]);

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        // Check if role is updated, or use existing role
        $role = $validated['role'] ?? $user->role;
        $birim_id = array_key_exists('birim_id', $validated) ? $validated['birim_id'] : $user->birim_id;
        $sube_id = array_key_exists('sube_id', $validated) ? $validated['sube_id'] : $user->sube_id;

        if ($role === 'birim_yoneticisi' && empty($birim_id)) {
            return response()->json(['message' => 'Birim yöneticisi için birim seçimi zorunludur.'], 422);
        }

        if ($role === 'sube_yoneticisi' && empty($sube_id)) {
            return response()->json(['message' => 'Şube yöneticisi için şube seçimi zorunludur.'], 422);
        }

        $user->update($validated);
        $user->load(['birim', 'sube']);

        return response()->json($user);
    }

    public function destroy(User $user)
    {
        $user->delete();
        return response()->json(null, 204);
    }
}
