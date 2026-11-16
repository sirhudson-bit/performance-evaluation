'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { UserForm } from '@/components/AdminForms';

/** Create-user flow in a Radix dialog so the list stays the page's primary content. */
export function AddUserDialog({
  roles,
  departments,
  isSuperAdmin,
}: {
  roles: { id: number; name: string; isProtected: boolean }[];
  departments: { id: number; name: string }[];
  isSuperAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden className="h-4 w-4" />
          افزودن کاربر
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>افزودن کاربر</DialogTitle>
          <DialogDescription>
            حساب جدید بسازید، دپارتمان و نقش‌ها را تعیین کنید. اگر رمز را خالی بگذارید، یک رمز موقت یک‌بار نمایش داده می‌شود.
          </DialogDescription>
        </DialogHeader>
        <UserForm roles={roles} departments={departments} isSuperAdmin={isSuperAdmin} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
