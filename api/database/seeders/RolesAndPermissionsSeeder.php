<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = [
            // Internal requests (Tier 1 — member submits to team lead)
            'internal-requests.create',
            'internal-requests.view-own',
            'internal-requests.view-department',
            'internal-requests.view-all',
            'internal-requests.review',       // team lead: approve / reject / revision

            // Finance requests (Tier 2 — team lead submits to Finance/SATGO)
            'finance-requests.create',        // team lead creates from approved internals
            'finance-requests.view-own',      // see requests you submitted
            'finance-requests.view-department',
            'finance-requests.view-all',
            'finance-requests.finance-review', // finance admin
            'finance-requests.finance-reject',
            'finance-requests.satgo-approve',  // super admin (SATGO)
            'finance-requests.satgo-reject',
            'finance-requests.record-payment', // finance admin
            'finance-requests.upload-receipt',
            'finance-requests.update',
            'finance-requests.delete',

            // Request types (admin manages)
            'request-types.manage',

            // Budgets
            'budgets.create',
            'budgets.view',
            'budgets.approve',
            'budgets.import',

            // Admin
            'departments.manage',
            'events.manage',
            'users.manage',

            // Exports
            'export.requests',
            'export.budgets',

            // Bank statements
            'bank-statements.upload',
            'bank-statements.view',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        // member: submit own internal requests, view own
        $member = Role::firstOrCreate(['name' => 'member']);
        $member->syncPermissions([
            'internal-requests.create',
            'internal-requests.view-own',
        ]);

        // team_lead: review department internal requests, create finance requests, view dept budgets
        $teamLead = Role::firstOrCreate(['name' => 'team_lead']);
        $teamLead->syncPermissions([
            'internal-requests.create',
            'internal-requests.view-own',
            'internal-requests.view-department',
            'internal-requests.review',
            'finance-requests.create',
            'finance-requests.view-own',
            'finance-requests.view-department',
            'finance-requests.delete',
            'finance-requests.upload-receipt',
            'budgets.view',
        ]);

        // finance_admin: finance review, record payments, upload receipts, budget management
        $financeAdmin = Role::firstOrCreate(['name' => 'finance_admin']);
        $financeAdmin->syncPermissions([
            'internal-requests.view-all',
            'finance-requests.view-all',
            'finance-requests.finance-review',
            'finance-requests.finance-reject',
            'finance-requests.record-payment',
            'finance-requests.upload-receipt',
            'finance-requests.update',
            'budgets.create',
            'budgets.view',
            'budgets.approve',
            'budgets.import',
            'request-types.manage',
            'export.requests',
            'export.budgets',
            'bank-statements.upload',
            'bank-statements.view',
        ]);

        // super_admin: all permissions (includes SATGO approval)
        $superAdmin = Role::firstOrCreate(['name' => 'super_admin']);
        $superAdmin->syncPermissions(Permission::all());

        // Seed default request types
        $types = [
            ['name' => 'Cash Disbursement', 'slug' => 'cash_disbursement', 'description' => 'Direct cash payment to requester or vendor'],
            ['name' => 'Procurement',        'slug' => 'procurement',        'description' => 'Purchase of goods or services'],
            ['name' => 'Reimbursement',      'slug' => 'reimbursement',      'description' => 'Refund of pre-approved out-of-pocket expense'],
            ['name' => 'Vendor Payment',     'slug' => 'vendor_payment',     'description' => 'Direct payment to an external vendor'],
        ];

        $now = now();
        foreach ($types as $type) {
            DB::table('request_types')->updateOrInsert(
                ['slug' => $type['slug']],
                array_merge($type, ['is_active' => true, 'created_at' => $now, 'updated_at' => $now])
            );
        }
    }
}
