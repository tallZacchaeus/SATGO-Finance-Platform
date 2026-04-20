<?php

namespace App\Modules\FinanceRequest\Controllers;

use App\Modules\FinanceRequest\Models\FinanceRequest;
use App\Modules\FinanceRequest\Requests\RecordPaymentRequest;
use App\Modules\FinanceRequest\Requests\RejectRequest;
use App\Modules\FinanceRequest\Requests\UploadReceiptRequest;
use App\Modules\FinanceRequest\Resources\FinanceRequestDetailResource;
use App\Modules\FinanceRequest\Services\ApprovalService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;

class RequestApprovalController extends Controller
{
    use AuthorizesRequests;

    public function __construct(private ApprovalService $approvalService) {}

    private function loadRelations(FinanceRequest $request): FinanceRequest
    {
        return $request->load([
            'requester', 'department', 'event', 'requestType',
            'financeReviewedBy', 'satgoApprovedBy', 'rejectedBy',
            'paidConfirmedBy', 'receiptedBy', 'completedBy',
            'documents', 'receipts', 'payments',
        ]);
    }

    public function financeReview(\Illuminate\Http\Request $request, int $id): JsonResponse
    {
        $financeRequest = FinanceRequest::findOrFail($id);
        $this->authorize('financeReview', $financeRequest);
        $updated = $this->approvalService->financeReview($financeRequest, $request->user());

        return response()->json([
            'success' => true,
            'data'    => new FinanceRequestDetailResource($this->loadRelations($updated)),
            'message' => 'Request reviewed and forwarded to SATGO.',
        ]);
    }

    public function financeReject(RejectRequest $request, int $id): JsonResponse
    {
        $financeRequest = FinanceRequest::findOrFail($id);
        $this->authorize('financeReject', $financeRequest);
        $updated = $this->approvalService->financeReject(
            $financeRequest,
            $request->user(),
            $request->reason,
            $request->category,
        );

        return response()->json([
            'success' => true,
            'data'    => new FinanceRequestDetailResource($this->loadRelations($updated)),
            'message' => 'Request rejected by finance team.',
        ]);
    }

    public function satgoApprove(\Illuminate\Http\Request $request, int $id): JsonResponse
    {
        $financeRequest = FinanceRequest::findOrFail($id);
        $this->authorize('satgoApprove', $financeRequest);
        $updated = $this->approvalService->satgoApprove($financeRequest, $request->user());

        return response()->json([
            'success' => true,
            'data'    => new FinanceRequestDetailResource($this->loadRelations($updated)),
            'message' => 'Request approved by SATGO.',
        ]);
    }

    public function satgoReject(RejectRequest $request, int $id): JsonResponse
    {
        $financeRequest = FinanceRequest::findOrFail($id);
        $this->authorize('satgoReject', $financeRequest);
        $updated = $this->approvalService->satgoReject(
            $financeRequest,
            $request->user(),
            $request->reason,
            $request->category,
        );

        return response()->json([
            'success' => true,
            'data'    => new FinanceRequestDetailResource($this->loadRelations($updated)),
            'message' => 'Request rejected by SATGO.',
        ]);
    }

    public function recordPayment(RecordPaymentRequest $request, int $id): JsonResponse
    {
        $financeRequest = FinanceRequest::findOrFail($id);
        $this->authorize('recordPayment', $financeRequest);
        $updated = $this->approvalService->recordPayment(
            $financeRequest,
            $request->user(),
            $request->amount_kobo,
            $request->payment_method,
            $request->payment_reference,
            $request->notes,
        );

        return response()->json([
            'success' => true,
            'data'    => new FinanceRequestDetailResource($this->loadRelations($updated)),
            'message' => 'Payment recorded successfully.',
        ]);
    }

    public function uploadReceipt(UploadReceiptRequest $request, int $id): JsonResponse
    {
        $financeRequest = FinanceRequest::findOrFail($id);
        $this->authorize('uploadReceipt', $financeRequest);
        $updated = $this->approvalService->uploadReceipt(
            $financeRequest,
            $request->user(),
            $request->file('file'),
            $request->amount_kobo,
            $request->notes,
        );

        return response()->json([
            'success' => true,
            'data'    => new FinanceRequestDetailResource($this->loadRelations($updated)),
            'message' => 'Receipt uploaded successfully.',
        ]);
    }
}
