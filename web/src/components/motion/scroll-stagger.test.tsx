import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ScrollStagger, StaggerItem } from '@/components/motion/primitives';
import { Card } from '@/components/ui/card';
import { stubMotionPreference } from '@/test/motion-media';

const originalMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

function Page() {
  return (
    <ScrollStagger>
      <StaggerItem>
        <Card data-testid="nested-card">Dans un bloc</Card>
      </StaggerItem>
      <Card data-testid="card">Carte</Card>
      <table>
        <thead>
          <tr data-testid="head-row">
            <th>Titre</th>
          </tr>
        </thead>
        <tbody>
          <tr data-testid="row">
            <td>Ligne</td>
          </tr>
        </tbody>
      </table>
    </ScrollStagger>
  );
}

describe('ScrollStagger', () => {
  it('hides cards, items and body rows until they scroll into view, leaving headers and nested cards alone', () => {
    stubMotionPreference('full');
    render(<Page />);
    expect(screen.getByTestId('card').style.visibility).toBe('hidden');
    expect(screen.getByTestId('row').style.visibility).toBe('hidden');
    expect(screen.getByTestId('nested-card').closest('[data-scroll-item]')).toHaveStyle({ visibility: 'hidden' });
    expect(screen.getByTestId('nested-card').style.visibility).toBe('');
    expect(screen.getByTestId('head-row').style.visibility).toBe('');
  });

  it('shows everything as-is under prefers-reduced-motion', () => {
    stubMotionPreference('reduced');
    render(<Page />);
    for (const id of ['card', 'row', 'nested-card', 'head-row']) {
      expect(screen.getByTestId(id).style.visibility).toBe('');
    }
    expect(screen.getByTestId('nested-card').closest('[data-scroll-item]')?.getAttribute('style')).toBeNull();
  });
});
