<?php

use App\Modules\FinanceRequest\Controllers\FinanceRequestController;
use App\Modules\FinanceRequest\Controllers\RequestApprovalController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'active'])->prefix('finance-requests')->group(function () {
    Route::get('/', [FinanceRequestController::class, 'index']);
    Route::post('/', [FinanceRequestController::class, 'store'])->middleware('permission:finance-requests.create');
    Route::get('{id}', [FinanceRequestController::class, 'show']);
    Route::put('{id}', [FinanceRequestController::class, 'update']);
    Route::delete('{id}', [FinanceRequestController::class, 'destroy']);
    Route::post('{id}/documents', [FinanceRequestController::class, 'uploadDocument']);
    Route::get('{id}/documents/{documentId}/download', [FinanceRequestController::class, 'downloadDocument'])->name('finance-requests.documents.download');
    Route::get('{id}/receipts/{receiptId}/download', [FinanceRequestController::class, 'downloadReceipt'])->name('finance-requests.receipts.download');

    // Two-tier approval chain
    Route::post('{id}/finance-review', [RequestApprovalController::class, 'financeReview'])->middleware('permission:finance-requests.finance-review');
    Route::post('{id}/finance-reject', [RequestApprovalController::class, 'financeReject'])->middleware('permission:finance-requests.finance-reject');
    Route::post('{id}/satgo-approve', [RequestApprovalController::class, 'satgoApprove'])->middleware('permission:finance-requests.satgo-approve');
    Route::post('{id}/satgo-reject', [RequestApprovalController::class, 'satgoReject'])->middleware('permission:finance-requests.satgo-reject');
    Route::post('{id}/record-payment', [RequestApprovalController::class, 'recordPayment'])->middleware('permission:finance-requests.record-payment');
    Route::post('{id}/upload-receipt', [RequestApprovalController::class, 'uploadReceipt'])->middleware('permission:finance-requests.upload-receipt');
});
