import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  designation: z.enum(['Team Lead', 'Unit Head', 'Pastor']).optional(),
  department: z.string().min(1, 'Department is required').optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = session.user as { id: string; role?: string };

    // Users can only edit their own profile; admins can edit anyone
    if (currentUser.id !== params.id && currentUser.role !== 'admin') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validated = updateProfileSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: validated.error.flatten() },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const userRef = db.collection('users').doc(params.id);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updated_at: FieldValue.serverTimestamp() };
    if (validated.data.name !== undefined) updates.name = validated.data.name.trim();
    if (validated.data.designation !== undefined) updates.designation = validated.data.designation;
    if (validated.data.department !== undefined) updates.department = validated.data.department;

    await userRef.update(updates);

    return NextResponse.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('PATCH /api/users/[id]/profile error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
