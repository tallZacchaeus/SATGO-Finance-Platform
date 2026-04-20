<?php

namespace App\Modules\FinanceRequest\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\ValidationException;

class StoreFinanceRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        // Finance admins and super admins may submit on behalf of any department.
        if ($user->can('finance-requests.view-all')) {
            return true;
        }

        // Everyone else must submit for their own department.
        $departmentId = (int) $this->input('department_id');
        if ($departmentId && $user->department_id !== $departmentId) {
            throw ValidationException::withMessages([
                'department_id' => 'You may only submit requests for your own department.',
            ]);
        }

        return true;
    }

    public function rules(): array
    {
        return [
            'event_id'        => ['required', 'exists:events,id'],
            'department_id'   => ['required', 'exists:departments,id'],
            'title'           => ['required', 'string', 'max:255'],
            'description'     => ['nullable', 'string'],
            'unit_cost_kobo'  => ['required', 'integer', 'min:1'],
            'quantity'        => ['required', 'integer', 'min:1'],
            'request_type_id' => ['required', 'exists:request_types,id'],
        ];
    }
}
