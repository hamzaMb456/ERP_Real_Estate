import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FieldHelp, FieldLabelWithHelp } from './field-help';

const HELP = 'Premier jour du bail, inclus.';

describe('FieldHelp', () => {
  it('renders a button with the constant accessible name « Aide »', () => {
    render(<FieldHelp>{HELP}</FieldHelp>);
    expect(screen.getByRole('button', { name: 'Aide' })).toBeInTheDocument();
  });

  it('keeps the help text hidden until asked', () => {
    render(<FieldHelp>{HELP}</FieldHelp>);
    expect(screen.queryByText(HELP)).not.toBeInTheDocument();
  });

  it('opens the help text on click', async () => {
    render(<FieldHelp>{HELP}</FieldHelp>);
    await userEvent.click(screen.getByRole('button', { name: 'Aide' }));
    expect(await screen.findByText(HELP)).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    render(<FieldHelp>{HELP}</FieldHelp>);
    await userEvent.click(screen.getByRole('button', { name: 'Aide' }));
    expect(await screen.findByText(HELP)).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText(HELP)).not.toBeInTheDocument();
  });

  it('opens from the keyboard (Tab then Enter)', async () => {
    render(<FieldHelp>{HELP}</FieldHelp>);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Aide' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByText(HELP)).toBeInTheDocument();
  });
});

describe('FieldLabelWithHelp', () => {
  it('keeps the label bound to its field, with the help button next to it', () => {
    render(
      <>
        <FieldLabelWithHelp htmlFor="loyer" help={HELP}>
          Loyer
        </FieldLabelWithHelp>
        <Input id="loyer" />
      </>,
    );
    expect(screen.getByLabelText('Loyer')).toHaveAttribute('id', 'loyer');
    expect(screen.getByRole('button', { name: 'Aide' })).toBeInTheDocument();
  });

  it('opens the help without moving focus into the field', async () => {
    render(
      <>
        <FieldLabelWithHelp htmlFor="loyer" help={HELP}>
          Loyer
        </FieldLabelWithHelp>
        <Input id="loyer" />
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Aide' }));
    expect(await screen.findByText(HELP)).toBeInTheDocument();
    expect(screen.getByLabelText('Loyer')).not.toHaveFocus();
  });

  it('works inside a dialog without closing it', async () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Titre</DialogTitle>
          <DialogDescription>Description</DialogDescription>
          <FieldLabelWithHelp htmlFor="loyer" help={HELP}>
            Loyer
          </FieldLabelWithHelp>
          <Input id="loyer" />
        </DialogContent>
      </Dialog>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Aide' }));
    expect(await screen.findByText(HELP)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Titre' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText(HELP)).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Titre' })).toBeInTheDocument();
  });
});
