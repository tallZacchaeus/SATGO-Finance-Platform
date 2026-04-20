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

const loginSchema = z.object({
  email:    z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPass,  setShowPass]  = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      try { await api.auth.logout(); } catch {}
      const res  = await api.auth.login(data.email, data.password);
      const role = res.data.role;
      toast.success('Signed in successfully');

      let destination = '/my-requests';
      if      (role === 'super_admin')   destination = '/admin';
      else if (role === 'finance_admin') destination = '/finance';
      else if (role === 'team_lead')     destination = '/team-lead';
      window.location.href = destination;
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message ?? 'Invalid email or password.');
      } else {
        toast.error('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 overflow-hidden relative bg-[#0A0616]">
      {/* Ambient orbs */}

      <motion.div
        className="w-full max-w-sm relative z-10"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 font-display text-3xl font-bold bg-gold text-[#0A0616]"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          >
            Y
          </motion.div>
          <h1 className="font-display text-2xl text-[#F5E8D3]">RCCG YAYA Finance</h1>
          <p className="font-body text-sm mt-1 text-[#A89FB8]">
            Sign in to your portal
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-7 bg-[#13093B] border border-[#2D1A73] ">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block font-body text-xs font-medium mb-1.5 text-[#A89FB8]">
                Email address
              </label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                placeholder="you@rccg.org"
                className="input-field"
              />
              {errors.email && (
                <p className="mt-1.5 text-xs font-body text-[#F87171]">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block font-body text-xs font-medium mb-1.5 text-[#A89FB8]">
                Password
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="input-field pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A89FB8]"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs font-body text-[#F87171]">{errors.password.message}</p>
              )}
            </div>

            <button type="submit" disabled={isLoading} className="btn-gold w-full mt-2">
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center font-body text-sm text-[#A89FB8]">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-[#D4A843] font-medium hover:opacity-80 transition-opacity">
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
