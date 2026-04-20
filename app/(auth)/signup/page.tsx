'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api-client';

const signupSchema = z
  .object({
    name:                  z.string().min(2, 'Name must be at least 2 characters'),
    email:                 z.string().email('Please enter a valid email address'),
    password:              z.string().min(8, 'Password must be at least 8 characters'),
    password_confirmation: z.string(),
  })
  .refine((d) => d.password === d.password_confirmation, {
    message: 'Passwords do not match',
    path: ['password_confirmation'],
  });

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPass,  setShowPass]  = useState(false);

  const { register, handleSubmit, setError, formState: { errors } } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupForm) => {
    setIsLoading(true);
    try {
      await api.auth.register(data);
      toast.success('Account created! Redirecting…');
      window.location.href = '/my-requests';
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.errors) {
          for (const [field, messages] of Object.entries(err.errors)) {
            setError(field as keyof SignupForm, { message: messages[0] });
          }
        } else {
          toast.error(err.message ?? 'Registration failed.');
        }
      } else {
        toast.error('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fields = [
    { name: 'name'                  as const, label: 'Full name',        type: 'text',     placeholder: 'John Doe',         auto: 'name' },
    { name: 'email'                 as const, label: 'Email address',    type: 'email',    placeholder: 'you@rccg.org',     auto: 'email' },
    { name: 'password'              as const, label: 'Password',         type: 'password', placeholder: '••••••••',         auto: 'new-password' },
    { name: 'password_confirmation' as const, label: 'Confirm password', type: 'password', placeholder: '••••••••',         auto: 'new-password' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 overflow-hidden relative bg-[#0A0616]">

      <motion.div
        className="w-full max-w-sm relative z-10"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 font-display text-3xl font-bold bg-gold text-[#0A0616]">
            Y
          </div>
          <h1 className="font-display text-2xl text-[#F5E8D3]">Create Account</h1>
          <p className="font-body text-sm mt-1 text-[#A89FB8]">Join RCCG YAYA Finance Portal</p>
        </div>

        <div className="rounded-2xl p-7 bg-[#13093B] border border-[#2D1A73] ">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {fields.map((f) => (
              <div key={f.name}>
                <label className="block font-body text-xs font-medium mb-1.5 text-[#A89FB8]">
                  {f.label}
                </label>
                <div className="relative">
                  <input
                    {...register(f.name)}
                    type={f.type === 'password' ? (showPass ? 'text' : 'password') : f.type}
                    autoComplete={f.auto}
                    placeholder={f.placeholder}
                    className="input-field"
                  />
                  {f.type === 'password' && f.name === 'password' && (
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A89FB8]"
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                {errors[f.name] && (
                  <p className="mt-1.5 text-xs font-body text-[#F87171]">{errors[f.name]?.message}</p>
                )}
              </div>
            ))}

            <button type="submit" disabled={isLoading} className="btn-gold w-full mt-2">
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center font-body text-sm text-[#A89FB8]">
            Already have an account?{' '}
            <Link href="/login" className="text-[#D4A843] font-medium hover:opacity-80 transition-opacity">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
