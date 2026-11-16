'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { QuestionForm } from '@/components/AdminForms';

/** Create-question flow in a Radix dialog; the question bank takes the full width. */
export function AddQuestionDialog({ categories }: { categories: { id: number; name: string }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden className="h-4 w-4" />
          پرسش جدید
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>پرسش جدید</DialogTitle>
          <DialogDescription>
            پرسش، نوع پاسخ، وزن و گزینه‌ها را تعیین کنید. هر ویرایش بعدی یک نسخه جدید می‌سازد و نسخه‌های قبلی حفظ می‌شوند.
          </DialogDescription>
        </DialogHeader>
        <QuestionForm categories={categories} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
