<?php

namespace App\Modules\FinanceRequest\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RejectRequest extends FormRequest
{
    public const CATEGORIES = [
        'budget_exceeded',
        'duplicate_request',
        'insufficient_documentation',
        'policy_violation',
        'out_of_scope',
        'other',
    ];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'reason'   => ['required', 'string', 'max:1000'],
            'category' => ['nullable', Rule::in(self::CATEGORIES)],
        ];
    }
}
