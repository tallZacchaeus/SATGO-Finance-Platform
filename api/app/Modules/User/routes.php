<?php

use App\Modules\User\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'active'])->prefix('users')->group(function () {
    Route::get('profile', [UserController::class, 'profile']);
    Route::put('profile', [UserController::class, 'updateProfile']);

    Route::get('/', [UserController::class, 'index'])->middleware('permission:users.manage');
    Route::get('{id}', [UserController::class, 'show'])->middleware('permission:users.manage');
    Route::put('{id}', [UserController::class, 'update'])->middleware('permission:users.manage');
    Route::delete('{id}', [UserController::class, 'destroy'])->middleware('permission:users.manage');
});
