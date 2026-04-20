<?php

namespace App\Modules\FinanceRequest\Controllers;

use App\Modules\FinanceRequest\Models\FinanceRequest;
use App\Modules\FinanceRequest\Models\Receipt;
use App\Modules\FinanceRequest\Models\RequestDocument;
use App\Modules\FinanceRequest\Requests\StoreFinanceRequestRequest;
use App\Modules\FinanceRequest\Requests\UpdateFinanceRequestRequest;
use App\Modules\FinanceRequest\Resources\FinanceRequestDetailResource;
use App\Modules\FinanceRequest\Resources\FinanceRequestResource;
use App\Modules\FinanceRequest\Services\FinanceRequestService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Storage;

class FinanceRequestController extends Controller
{
    use AuthorizesRequests;

    public function __construct(private FinanceRequestService $service) {}

    public function index(Request $request): JsonResponse
    {
        $user  = $request->user();
        $query = FinanceRequest::with(['requester', 'department', 'event', 'requestType']);

        // Role-based visibility
        if ($user->can('finance-requests.view-all')) {
            // No additional filter — see everything
        } elseif ($user->can('finance-requests.view-department')) {
            $query->where('department_id', $user->department_id);
        } else {
            $query->where('requester_id', $user->id);
        }

        // Optional query filters
        foreach (['event_id', 'department_id', 'status', 'request_type_id'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->input($filter));
            }
        }

        $perPage = min((int) $request->input('per_page', 20), 100);
        $results = $query->latest()->paginate($perPage);

        return response()->json([
            'success' => true,
            'data'    => FinanceRequestResource::collection($results),
            'meta'    => [
                'current_page' => $results->currentPage(),
                'last_page'    => $results->lastPage(),
                'per_page'     => $results->perPage(),
                'total'        => $results->total(),
            ],
        ]);
    }

    public function store(StoreFinanceRequestRequest $request): JsonResponse
    {
        $financeRequest = $this->service->create($request->validated(), $request->user());

        return response()->json([
            'success' => true,
            'data'    => new FinanceRequestDetailResource($financeRequest->load([
                'requester', 'department', 'event', 'requestType',
            ])),
            'message' => 'Finance request submitted successfully.',
        ], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $financeRequest = FinanceRequest::with([
            'requester', 'department', 'event', 'requestType',
            'financeReviewedBy', 'satgoApprovedBy', 'rejectedBy',
            'paidConfirmedBy', 'receiptedBy', 'completedBy',
            'documents', 'receipts', 'payments', 'reviewNotes.user',
        ])->findOrFail($id);

        $this->authorize('view', $financeRequest);

        return response()->json([
            'success' => true,
            'data'    => new FinanceRequestDetailResource($financeRequest),
        ]);
    }

    public function update(UpdateFinanceRequestRequest $request, int $id): JsonResponse
    {
        $financeRequest = FinanceRequest::findOrFail($id);
        $this->authorize('update', $financeRequest);

        $data = $request->validated();

        // Recalculate total amount if quantity or unit cost changed
        $quantity = $data['quantity']       ?? $financeRequest->quantity;
        $unitCost = $data['unit_cost_kobo'] ?? $financeRequest->unit_cost_kobo;
        $data['amount_kobo'] = $quantity * $unitCost;

        $financeRequest->update($data);

        return response()->json([
            'success' => true,
            'data'    => new FinanceRequestDetailResource($financeRequest->fresh([
                'requester', 'department', 'event', 'requestType',
            ])),
            'message' => 'Finance request updated successfully.',
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $financeRequest = FinanceRequest::findOrFail($id);
        $this->authorize('delete', $financeRequest);

        $financeRequest->delete();

        return response()->json([
            'success' => true,
            'message' => 'Finance request deleted successfully.',
        ]);
    }

    public function downloadDocument(Request $request, int $id, int $documentId): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $financeRequest = FinanceRequest::findOrFail($id);
        $this->authorize('view', $financeRequest);

        $document = RequestDocument::where('finance_request_id', $id)->findOrFail($documentId);

        abort_unless(Storage::disk('local')->exists($document->file_path), 404);

        return Storage::disk('local')->download($document->file_path, $document->file_name);
    }

    public function downloadReceipt(Request $request, int $id, int $receiptId): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $financeRequest = FinanceRequest::findOrFail($id);
        $this->authorize('view', $financeRequest);

        $receipt = Receipt::where('finance_request_id', $id)->findOrFail($receiptId);

        abort_unless(Storage::disk('local')->exists($receipt->file_path), 404);

        return Storage::disk('local')->download($receipt->file_path, $receipt->file_name);
    }

    public function uploadDocument(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:pdf,jpeg,jpg,png,webp', 'max:10240'],
        ]);

        $financeRequest = FinanceRequest::findOrFail($id);
        $this->authorize('view', $financeRequest);

        $document = $this->service->attachDocument($financeRequest, $request->file('file'), $request->user());

        return response()->json([
            'success' => true,
            'data'    => [
                'id'           => $document->id,
                'file_name'    => $document->file_name,
                'file_type'    => $document->file_type,
                'file_size'    => $document->file_size,
                'download_url' => route('finance-requests.documents.download', [$financeRequest->id, $document->id]),
                'uploaded_at'  => $document->created_at?->toIso8601String(),
            ],
            'message' => 'Document uploaded successfully.',
        ], 201);
    }
}
