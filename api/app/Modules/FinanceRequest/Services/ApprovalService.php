<?php

namespace App\Modules\FinanceRequest\Services;

use App\Modules\Budget\Services\BudgetService;
use App\Modules\FinanceRequest\Models\FinanceRequest;
use App\Modules\FinanceRequest\Models\Payment;
use App\Modules\FinanceRequest\Models\Receipt;
use App\Modules\FinanceRequest\StateMachine\RequestStatusMachine;
use App\Modules\User\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ApprovalService
{
    public function __construct(
        private RequestStatusMachine $stateMachine,
        private BudgetService $budgetService,
    ) {}

    /**
     * Finance team reviews/recommends the request to SATGO.
     */
    public function financeReview(FinanceRequest $request, User $actor): FinanceRequest
    {
        return $this->stateMachine->transition($request, FinanceRequest::STATUS_FINANCE_REVIEWED, $actor);
    }

    /**
     * Finance team rejects the request.
     */
    public function financeReject(FinanceRequest $request, User $actor, string $reason, ?string $category = null): FinanceRequest
    {
        return $this->stateMachine->transition(
            $request,
            FinanceRequest::STATUS_FINANCE_REJECTED,
            $actor,
            ['rejection_reason' => $reason, 'rejection_category' => $category]
        );
    }

    /**
     * SATGO (CEO/Director) gives final approval.
     */
    public function satgoApprove(FinanceRequest $request, User $actor): FinanceRequest
    {
        return DB::transaction(function () use ($request, $actor) {
            // Lock the budget row first so concurrent approvals queue behind this transaction.
            $budget = \App\Modules\Budget\Models\Budget::where('event_id', $request->event_id)
                ->where('department_id', $request->department_id)
                ->lockForUpdate()
                ->first();

            if (! $budget || ($budget->allocated_amount_kobo - $budget->spent_amount_kobo) < $request->amount_kobo) {
                throw ValidationException::withMessages([
                    'budget' => 'Approving this request would exceed the department budget allocation.',
                ]);
            }

            return $this->stateMachine->transition($request, FinanceRequest::STATUS_SATGO_APPROVED, $actor);
        });
    }

    /**
     * SATGO rejects the request.
     */
    public function satgoReject(FinanceRequest $request, User $actor, string $reason, ?string $category = null): FinanceRequest
    {
        return $this->stateMachine->transition(
            $request,
            FinanceRequest::STATUS_SATGO_REJECTED,
            $actor,
            ['rejection_reason' => $reason, 'rejection_category' => $category]
        );
    }

    /**
     * Record a payment (full or partial) against an approved request.
     */
    public function recordPayment(
        FinanceRequest $request,
        User $actor,
        int $amountKobo,
        string $paymentMethod,
        ?string $paymentReference = null,
        ?string $notes = null,
    ): FinanceRequest {
        return DB::transaction(function () use ($request, $actor, $amountKobo, $paymentMethod, $paymentReference, $notes) {
            // Lock the row so concurrent payment attempts block until this completes.
            $locked = FinanceRequest::lockForUpdate()->findOrFail($request->id);

            $alreadyPaid = $locked->payments()->sum('amount_kobo');
            if ($alreadyPaid + $amountKobo > $locked->amount_kobo) {
                throw ValidationException::withMessages([
                    'amount_kobo' => 'Payment would exceed the approved request amount.',
                ]);
            }

            Payment::create([
                'finance_request_id' => $locked->id,
                'amount_kobo'        => $amountKobo,
                'payment_method'     => $paymentMethod,
                'payment_reference'  => $paymentReference,
                'payment_date'       => now(),
                'notes'              => $notes,
                'recorded_by'        => $actor->id,
            ]);

            // Recalculate and persist status (partial_payment or paid)
            $locked->recalculateTotalPaid();

            return $locked->fresh();
        });
    }

    /**
     * Upload a receipt for a paid request (moves to receipted status).
     */
    public function uploadReceipt(
        FinanceRequest $request,
        User $actor,
        UploadedFile $file,
        int $amountKobo,
        ?string $notes = null,
    ): FinanceRequest {
        $path = $file->store('receipts', 'local');

        Receipt::create([
            'finance_request_id' => $request->id,
            'file_name'          => $file->getClientOriginalName(),
            'file_path'          => $path,
            'file_type'          => $file->getClientOriginalExtension(),
            'file_size'          => $file->getSize(),
            'amount_kobo'        => $amountKobo,
            'notes'              => $notes,
            'uploaded_by'        => $actor->id,
        ]);

        return $this->stateMachine->transition($request, FinanceRequest::STATUS_RECEIPTED, $actor);
    }
}
