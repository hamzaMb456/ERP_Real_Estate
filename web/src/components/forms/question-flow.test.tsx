import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/provider';
import { ChoiceChips, MultiChips, QuestionFlow, type FlowStep } from './question-flow';

const steps: FlowStep[] = [
  { id: 'name', title: 'What is it called?', fields: ['name'], children: <input aria-label="Name" /> },
  { id: 'size', title: 'How big is it?', fields: ['surface'], optional: true, children: <input aria-label="Surface" /> },
  { id: 'done', title: 'Ready?', children: <p>All set</p> },
];

function setup(overrides: { trigger?: (names?: string[]) => Promise<boolean>; stepList?: FlowStep[] } = {}) {
  const trigger = vi.fn(overrides.trigger ?? (async () => true));
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <I18nProvider>
      <QuestionFlow steps={overrides.stepList ?? steps} trigger={trigger} onSubmit={onSubmit} onCancel={onCancel} submitting={false} submitLabel="Save unit" />
    </I18nProvider>,
  );
  return { trigger, onSubmit, onCancel, user: userEvent.setup() };
}

describe('QuestionFlow', () => {
  it('shows one question at a time with its counter and a progress bar', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'What is it called?' })).toBeInTheDocument();
    expect(screen.queryByText('How big is it?')).not.toBeInTheDocument();
    expect(screen.getByText('Question 1 sur 3')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  });

  it('checks the question’s fields, then moves on; Retour goes back', async () => {
    const { trigger, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(trigger).toHaveBeenCalledWith(['name']);
    expect(await screen.findByRole('heading', { name: 'How big is it?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retour' }));
    expect(await screen.findByRole('heading', { name: 'What is it called?' })).toBeInTheDocument();
  });

  it('stays on the question when its fields are invalid', async () => {
    const { user } = setup({ trigger: async () => false });
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'What is it called?' })).toBeInTheDocument());
    expect(screen.queryByText('How big is it?')).not.toBeInTheDocument();
  });

  it('continues on Enter in a text field', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText('Name'), 'B-102{Enter}');
    expect(await screen.findByRole('heading', { name: 'How big is it?' })).toBeInTheDocument();
  });

  it('lets an optional question be skipped without checking it, and cancels from the first question', async () => {
    const { trigger, user, onCancel } = setup();
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onCancel).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    trigger.mockClear();
    await user.click(await screen.findByRole('button', { name: 'Passer' }));
    expect(await screen.findByRole('heading', { name: 'Ready?' })).toBeInTheDocument();
    expect(trigger).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Passer' })).not.toBeInTheDocument();
  });

  it('saves on the last question after checking every question again', async () => {
    const { trigger, onSubmit, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(await screen.findByRole('button', { name: 'Passer' }));
    trigger.mockClear();
    await user.click(await screen.findByRole('button', { name: 'Save unit' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(trigger.mock.calls.map(([names]) => names)).toEqual([['name'], ['surface']]);
  });

  it('jumps back to the first question with a problem instead of saving', async () => {
    let allowName = true;
    const { onSubmit, user } = setup({ trigger: async (names) => !(names?.includes('name') && !allowName) });
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(await screen.findByRole('button', { name: 'Passer' }));
    allowName = false;
    await user.click(await screen.findByRole('button', { name: 'Save unit' }));
    expect(await screen.findByRole('heading', { name: 'What is it called?' })).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps its place when a later question appears or disappears', async () => {
    const withExtra: FlowStep[] = [steps[0], { id: 'extra', title: 'Extra?', children: <p>extra</p> }, ...steps.slice(1)];
    function Harness() {
      const [extra, setExtra] = useState(false);
      return (
        <I18nProvider>
          <button type="button" onClick={() => setExtra((value) => !value)}>
            toggle extra
          </button>
          <QuestionFlow steps={extra ? withExtra : steps} trigger={async () => true} onSubmit={vi.fn()} onCancel={vi.fn()} submitting={false} submitLabel="Save unit" />
        </I18nProvider>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(await screen.findByRole('heading', { name: 'How big is it?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'toggle extra' }));
    expect(screen.getByRole('heading', { name: 'How big is it?' })).toBeInTheDocument();
    expect(screen.getByText('Question 3 sur 4')).toBeInTheDocument();
  });
});

describe('ChoiceChips and MultiChips', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
  ] as const;

  it('ChoiceChips marks the selected option and reports a pick', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ChoiceChips label="Pick" value="a" options={options} onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'false');
    await user.click(screen.getByRole('radio', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('MultiChips toggles values on and off', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<MultiChips label="Pick" value={['a']} options={options} onChange={onChange} />);
    await user.click(screen.getByRole('checkbox', { name: 'Beta' }));
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
    await user.click(screen.getByRole('checkbox', { name: 'Alpha' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
