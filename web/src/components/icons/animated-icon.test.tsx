import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Loader2, Map as MapIcon, Plus, type LucideIcon } from '@/components/icons';
import { ICON_DATA } from '@/components/icons/icon-data';
import { makeIcon } from '@/components/icons/animated-icon';

describe('AnimatedIcon', () => {
  it('renders decorative icons hidden from assistive tech', () => {
    const { container } = render(<Plus className="size-4" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role');
    expect(svg).toHaveClass('size-4');
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
  });

  it('exposes labelled icons as images', () => {
    render(<Plus aria-label="Add" />);
    const svg = screen.getByRole('img', { name: 'Add' });
    expect(svg).not.toHaveAttribute('aria-hidden');
  });

  it('wraps the geometry in a glyph group', () => {
    const { container } = render(<Plus />);
    const glyph = container.querySelector('g[data-glyph]');
    expect(glyph?.children).toHaveLength(ICON_DATA.Plus.length);
  });

  it('keeps size and stroke overrides', () => {
    const { container } = render(<Plus size={16} strokeWidth={1.5} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '16');
    expect(svg).toHaveAttribute('stroke-width', '1.5');
  });

  it('exports Map without shadowing the global Map', () => {
    expect(new Map([[1, 2]]).get(1)).toBe(2);
    const { container } = render(<MapIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(Loader2.displayName).toBe('Loader2');
  });
});

describe('makeIcon', () => {
  it('builds a named component and applies defaults that props can override', () => {
    const Custom: LucideIcon = makeIcon('Plus', { size: 20 });
    expect(Custom.displayName).toBe('Plus');
    const { container, rerender } = render(<Custom />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '20');
    rerender(<Custom size={12} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '12');
  });
});
