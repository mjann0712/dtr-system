<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index()
    {
        return response()->json(['data' => User::orderBy('name')->get(['id', 'name', 'email', 'role', 'created_at'])]);
    }

    public function store(Request $request)
    {
        $d = $request->validate(['name' => 'required|string|max:120', 'email' => 'required|email|unique:users,email', 'password' => 'required|string|min:8', 'role' => ['required', Rule::in(['admin', 'staff'])]]);
        $u = User::create(['name' => $d['name'], 'email' => $d['email'], 'password' => Hash::make($d['password']), 'role' => $d['role']]);

        return response()->json($u->only(['id', 'name', 'email', 'role']), 201);
    }

    public function destroy(Request $request, User $user)
    {
        abort_if($user->id === $request->user()->id, 422, 'You cannot delete your own account.');
        $user->tokens()->delete();
        $user->delete();

        return response()->noContent();
    }
}
