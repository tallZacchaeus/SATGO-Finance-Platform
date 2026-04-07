'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { User as UserIcon, Building2, BadgeCheck, Loader2 } from 'lucide-react';
import { User, UserDesignation } from '@/lib/types';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';

const DESIGNATIONS: UserDesignation[] = ['Team Lead', 'Unit Head', 'Pastor'];

const DEPARTMENTS = [
  'Youth Affairs',
  'Finance',
  'Administration',
  'Programs',
  'Communications',
  'Operations',
  'Other',
];

export default function SettingsPage() {
  const [profile, setProfile] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState('');
  const [designation, setDesignation] = useState<UserDesignation | ''>('');
  const [department, setDepartment] = useState('');

  useEffect(() => {
    async function loadProfile() {
      try {
        // /api/users returns all users (admin only), so we load the current
        // user's profile via the session-backed requests endpoint by fetching
        // a dedicated profile route — re-use the users list and find self.
        // Simpler: fetch /api/users/me via GET /api/session/me if it exists,
        // otherwise call /api/requests?limit=1 to pull session user details.
        // Here we use a lightweight approach: GET /api/users filtered to self.
        const res = await fetch('/api/profile');
        if (!res.ok) throw new Error('Failed to load profile');
        const data = await res.json();
        const user: User = data.user;
        setProfile(user);
        setName(user.name || '');
        setDesignation((user.designation as UserDesignation) || '');
        setDepartment(user.department || '');
      } catch {
        toast.error('Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (name.trim().length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/users/${profile.id}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          designation: designation || undefined,
          department: department || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to save');
      }

      setProfile((prev) =>
        prev
          ? { ...prev, name: name.trim(), designation: designation as UserDesignation, department }
          : prev
      );
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <Header title="Settings" userId={profile?.id || ''} />

      <div className="p-6 max-w-xl mx-auto">
        {isLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading profile...
          </div>
        ) : !profile ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            Could not load profile.
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Profile card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm flex-shrink-0">
                  {(profile.name || profile.email || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{profile.name || profile.email}</p>
                  <p className="text-sm text-gray-500">{profile.email}</p>
                </div>
                <span className={`ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${profile.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                  {profile.role}
                </span>
              </div>

              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="inline-flex items-center gap-1.5"><UserIcon className="w-4 h-4" /> Full name</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  placeholder="Your full name"
                />
              </div>

              {/* Designation */}
              <div>
                <label htmlFor="designation" className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="inline-flex items-center gap-1.5"><BadgeCheck className="w-4 h-4" /> Designation</span>
                </label>
                <select
                  id="designation"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value as UserDesignation | '')}
                  className="input-field"
                >
                  <option value="">Select designation</option>
                  {DESIGNATIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Department */}
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="inline-flex items-center gap-1.5"><Building2 className="w-4 h-4" /> Unit / Department</span>
                </label>
                <select
                  id="department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="input-field"
                >
                  <option value="">Select unit / department</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>

            <Button type="submit" isLoading={isSaving} className="w-full">
              Save changes
            </Button>

            <p className="text-xs text-center text-gray-400">
              To change your email or password, contact your administrator.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
