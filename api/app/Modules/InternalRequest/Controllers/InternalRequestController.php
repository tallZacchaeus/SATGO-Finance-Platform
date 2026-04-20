<?php

namespace App\Modules\InternalRequest\Controllers;

use App\Modules\FinanceRequest\Models\RequestDocument;
use App\Modules\FinanceRequest\Models\ReviewNote;
use App\Modules\InternalRequest\Models\InternalRequest;
use App\Modules\InternalRequest\Requests\ReviewInternalRequestRequest;
use App\Modules\InternalRequest\Requests\StoreInternalRequestRequest;
use App\Modules\InternalRequest\Requests\UpdateInternalRequestRequest;
use App\Modules\InternalRequest\Resources\InternalRequestResource;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class InternalRequestController extends Controller
{
    use AuthorizesRequests;

    private function eagerLoads(): array
    {
        return ['requester', 'department', 'event', 'requestType', 'reviewedBy', 'reviewNotes.user', 'documents'];
    }

    public function index(Request $request): JsonResponse
    {
        $user  = $request->user();
        $query = InternalRequest::with($this->eagerLoads());

        if ($user->can('internal-requests.view-all')) {
            // no filter
        } elseif ($user->can('internal-requests.view-department')) {
            $query->where('department_id', $user->department_id);
        } else {
            $query->where('requester_id', $user->id);
        }

        foreach (['event_id', 'department_id', 'status'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->input($filter));
            }
        }

        $perPage = min((int) $request->input('per_page', 20), 100);
        $results = $query->latest()->paginate($perPage);

        return response()->json([
            'success' => true,
            'data'    => InternalRequestResource::collection($results),
            'meta'    => [
                'current_page' => $results->currentPage(),
                'last_page'    => $results->lastPage(),
                'per_page'     => $results->perPage(),
                'total'        => $results->total(),
            ],
        ]);
    }

    public function store(StoreInternalRequestRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['requester_id'] = $request->user()->id;
        $data['amount_kobo']  = $data['unit_cost_kobo'] * $data['quantity'];
        $data['status']       = InternalRequest::STATUS_DRAFT;

        $internalRequest = DB::transaction(function () use ($data) {
            $data['reference'] = $this->generateReference();
            return InternalRequest::create($data);
        });

        $internalRequest->load($this->eagerLoads());

        return response()->json([
            'success' => true,
            'data'    => new InternalRequestResource($internalRequest),
            'message' => 'Internal request created.',
        ], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $internalRequest = InternalRequest::with($this->eagerLoads())->findOrFail($id);
        $this->authorize('view', $internalRequest);

        return response()->json([
            'success' => true,
            'data'    => new InternalRequestResource($internalRequest),
        ]);
    }

    public function update(UpdateInternalRequestRequest $request, int $id): JsonResponse
    {
        $internalRequest = InternalRequest::findOrFail($id);
        $this->authorize('update', $internalRequest);

        $data = $request->validated();
        if (isset($data['unit_cost_kobo']) || isset($data['quantity'])) {
            $unitCost = $data['unit_cost_kobo'] ?? $internalRequest->unit_cost_kobo;
            $quantity = $data['quantity']        ?? $internalRequest->quantity;
            $data['amount_kobo'] = $unitCost * $quantity;
        }

        $internalRequest->update($data);
        $internalRequest->load($this->eagerLoads());

        return response()->json([
            'success' => true,
            'data'    => new InternalRequestResource($internalRequest),
            'message' => 'Internal request updated.',
        ]);
    }

    public function submit(Request $request, int $id): JsonResponse
    {
        $internalRequest = InternalRequest::findOrFail($id);
        $this->authorize('submit', $internalRequest);

        $internalRequest->update(['status' => InternalRequest::STATUS_SUBMITTED]);
        $internalRequest->load($this->eagerLoads());

        return response()->json([
            'success' => true,
            'data'    => new InternalRequestResource($internalRequest),
            'message' => 'Request submitted for team lead review.',
        ]);
    }

    public function review(ReviewInternalRequestRequest $request, int $id): JsonResponse
    {
        $internalRequest = InternalRequest::findOrFail($id);
        $this->authorize('review', $internalRequest);

        $action = $request->input('action');
        $notes  = $request->input('notes');
        $user   = $request->user();

        $newStatus = match ($action) {
            'lead_approve'          => InternalRequest::STATUS_APPROVED,
            'lead_reject'           => InternalRequest::STATUS_REJECTED,
            'lead_revision_request' => InternalRequest::STATUS_NEEDS_REVISION,
        };

        $internalRequest->update([
            'status'      => $newStatus,
            'reviewed_by' => $user->id,
            'reviewed_at' => now(),
        ]);

        ReviewNote::create([
            'noteable_type' => InternalRequest::class,
            'noteable_id'   => $internalRequest->id,
            'user_id'       => $user->id,
            'action'        => $action,
            'notes'         => $notes,
        ]);

        $internalRequest->load($this->eagerLoads());

        return response()->json([
            'success' => true,
            'data'    => new InternalRequestResource($internalRequest),
            'message' => 'Review recorded.',
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $internalRequest = InternalRequest::findOrFail($id);
        $this->authorize('delete', $internalRequest);

        $internalRequest->delete();

        return response()->json([
            'success' => true,
            'message' => 'Internal request deleted.',
        ]);
    }

    public function uploadDocument(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'max:10240', 'mimes:pdf,jpg,jpeg,png,webp'],
        ]);

        $internalRequest = InternalRequest::findOrFail($id);
        $this->authorize('view', $internalRequest);

        $file     = $request->file('file');
        $path     = $file->store('internal-request-documents', 'public');
        $document = RequestDocument::create([
            'internal_request_id' => $internalRequest->id,
            'file_name'  => $file->getClientOriginalName(),
            'file_path'  => $path,
            'file_type'  => $file->getClientOriginalExtension(),
            'file_size'  => $file->getSize(),
            'uploaded_by' => $request->user()->id,
        ]);

        return response()->json([
            'success' => true,
            'data'    => [
                'id'          => $document->id,
                'file_name'   => $document->file_name,
                'file_type'   => $document->file_type,
                'file_size'   => $document->file_size,
                'url'         => asset('storage/' . $path),
                'uploaded_at' => $document->created_at->toISOString(),
            ],
            'message' => 'Document uploaded.',
        ], 201);
    }

    private function generateReference(): string
    {
        $year    = now()->year;
        $lastRef = InternalRequest::withTrashed()
            ->where('reference', 'like', "INT-{$year}-%")
            ->lockForUpdate()
            ->orderByDesc('id')
            ->value('reference');

        $next = $lastRef
            ? (int) Str::afterLast($lastRef, '-') + 1
            : 1;

        return sprintf('INT-%d-%05d', $year, $next);
    }
}
