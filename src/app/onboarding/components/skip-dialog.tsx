"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SkipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmSkip: () => void;
}

export function SkipDialog({ open, onOpenChange, onConfirmSkip }: SkipDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">Skip the quiz?</AlertDialogTitle>
          <AlertDialogDescription className="text-base leading-relaxed">
            Completing these 10 questions makes the AI work{" "}
            <span className="font-semibold text-foreground">10x better</span> for
            you. It only takes a couple minutes and helps us personalize every
            recommendation.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="flex-1">Let&apos;s do it</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmSkip}
            className="flex-1 bg-muted text-muted-foreground hover:bg-muted/80"
          >
            Skip anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
