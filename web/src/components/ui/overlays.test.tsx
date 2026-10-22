import { createRef } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { stubMotionPreference } from '@/test/motion-media';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';

describe('dialog and sheet entrances', () => {
  it('renders open dialog content, forwards its ref and keeps the exit animation classes', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Dialog open>
        <DialogContent ref={ref}>
          <DialogTitle>Titre</DialogTitle>
          <DialogDescription>Texte</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Titre' });
    expect(ref.current).toBe(dialog);
    expect(dialog).toHaveClass('data-closed:animate-out');
    expect(dialog).not.toHaveClass('data-open:animate-dialog-pop');
  });

  it('renders each sheet side without the CSS slide-in classes', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Sheet open>
        <SheetContent side="left" ref={ref}>
          <SheetTitle>Panneau</SheetTitle>
          <SheetDescription>Texte</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    const sheet = screen.getByRole('dialog', { name: 'Panneau' });
    expect(ref.current).toBe(sheet);
    expect(sheet).toHaveAttribute('data-side', 'left');
    expect(sheet.className).not.toContain('slide-in-from');
    expect(sheet.className).toContain('slide-out-to-left-10');
  });
});

describe('entrance motion preference', () => {
  const renderDialog = () =>
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Titre</DialogTitle>
          <DialogDescription>Texte</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
  const renderSheet = () =>
    render(
      <Sheet open>
        <SheetContent side="right">
          <SheetTitle>Panneau</SheetTitle>
          <SheetDescription>Texte</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
  const originalMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('runs the GSAP entrance (CSS transition parked, start state applied) with full motion', () => {
    stubMotionPreference('full');
    renderDialog();
    const dialog = screen.getByRole('dialog');
    expect(dialog.style.transition).toBe('none');
    expect(dialog.style.opacity).toBe('0');
    cleanup();
    renderSheet();
    const sheet = screen.getByRole('dialog');
    expect(sheet.style.transition).toBe('none');
    expect(sheet.style.opacity).toBe('0');
  });

  it('applies no entrance styles under prefers-reduced-motion', () => {
    stubMotionPreference('reduced');
    renderDialog();
    const dialog = screen.getByRole('dialog');
    expect(dialog.style.transition).toBe('');
    expect(dialog.style.opacity).toBe('');
    expect(dialog.style.transform).toBe('');
    cleanup();
    renderSheet();
    const sheet = screen.getByRole('dialog');
    expect(sheet.style.transition).toBe('');
    expect(sheet.style.opacity).toBe('');
    expect(sheet.style.transform).toBe('');
  });
});
