import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('keeps the gloss classes and data attributes', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveClass('btn-gloss');
    expect(button).toHaveAttribute('data-variant', 'default');
    expect(button).toHaveAttribute('data-size', 'default');
  });

  it('forwards its ref to the underlying element', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBe(screen.getByRole('button', { name: 'Ref' }));
  });

  it('renders the child element with asChild and merges the ref', () => {
    const ref = createRef<HTMLAnchorElement>();
    render(
      <Button asChild variant="outline">
        <a href="https://example.test/biens" ref={ref}>
          Biens
        </a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Biens' });
    expect(link).toHaveClass('btn-gloss-soft');
    expect(ref.current).toBe(link);
  });

  it('leaves disabled buttons disabled', () => {
    render(<Button disabled>Off</Button>);
    expect(screen.getByRole('button', { name: 'Off' })).toBeDisabled();
  });
});
