<?php

namespace App\Modules\FinanceRequest\Services;

use App\Modules\FinanceRequest\Events\RequestStatusChanged;
use App\Modules\FinanceRequest\Models\FinanceRequest;
use App\Modules\FinanceRequest\Models\RequestDocument;
use App\Modules\User\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

class FinanceRequestService
{
    public function create(array $validated, User $requester): FinanceRequest
    {
        $amountKobo = $validated['unit_cost_kobo'] * $validated['quantity'];

        $request = DB::transaction(function () use ($validated, $requester, $amountKobo) {
            return FinanceRequest::create([
                'reference'       => $this->generateReference(),
                'event_id'        => $validated['event_id'],
                'department_id'   => $validated['department_id'],
                'requester_id'    => $requester->id,
                'title'           => $validated['title'],
                'description'     => $validated['description'] ?? null,
                'unit_cost_kobo'  => $validated['unit_cost_kobo'],
                'quantity'        => $validated['quantity'],
                'amount_kobo'     => $amountKobo,
                'request_type_id' => $validated['request_type_id'],
                'status'          => FinanceRequest::STATUS_SUBMITTED,
            ]);
        });

        // Fire the submitted event so finance admins are notified
        RequestStatusChanged::dispatch($request, '', FinanceRequest::STATUS_SUBMITTED, $requester);

        return $request;
    }

    public function attachDocument(FinanceRequest $request, UploadedFile $file, User $uploader): RequestDocument
    {
        $path = $file->store('request-documents', 'local');

        return RequestDocument::create([
            'finance_request_id' => $request->id,
            'file_name'          => $file->getClientOriginalName(),
            'file_path'          => $path,
            'file_type'          => $file->getClientOriginalExtension(),
            'file_size'          => $file->getSize(),
            'uploaded_by'        => $uploader->id,
        ]);
    }

    private function generateReference(): string
    {
        $year = now()->year;

        // lockForUpdate() is effective here because this method is always
        // called from within a DB::transaction() in create().
        $last = FinanceRequest::withTrashed()
            ->where('reference', 'like', "NYAYA-{$year}-%")
            ->lockForUpdate()
            ->orderByDesc('reference')
            ->value('reference');

        $sequence = 1;
        if ($last) {
            $parts    = explode('-', $last);
            $sequence = (int) end($parts) + 1;
        }

        return sprintf('NYAYA-%d-%05d', $year, $sequence);
    }
}
