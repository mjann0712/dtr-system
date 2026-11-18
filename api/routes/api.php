<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BiometricController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\ImportController;
use App\Http\Controllers\Api\PeriodController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/settings', [SettingController::class, 'show']);
    Route::put('/settings', [SettingController::class, 'update']);

    Route::get('/employees', [EmployeeController::class, 'index']);
    Route::post('/employees', [EmployeeController::class, 'store']);
    Route::post('/employees/status', [EmployeeController::class, 'status']);
    Route::put('/employees/{employee}', [EmployeeController::class, 'update']);
    Route::delete('/employees/{employee}', [EmployeeController::class, 'destroy']);

    Route::get('/biometric/unlinked', [BiometricController::class, 'unlinked']);
    Route::post('/biometric/link', [BiometricController::class, 'link']);
    Route::post('/biometric/{acNo}/ignore', [BiometricController::class, 'ignore']);

    Route::get('/periods', [PeriodController::class, 'index']);
    Route::get('/periods/{period}/dtr', [PeriodController::class, 'dtr'])->where('period', '\d{4}-\d{2}');
    Route::delete('/periods/{period}', [PeriodController::class, 'destroy'])->where('period', '\d{4}-\d{2}');

    Route::post('/import', [ImportController::class, 'store']);

    Route::middleware(\App\Http\Middleware\EnsureAdmin::class)->group(function () {
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::delete('/users/{user}', [UserController::class, 'destroy']);
    });
});
