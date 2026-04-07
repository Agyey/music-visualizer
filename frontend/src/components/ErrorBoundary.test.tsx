import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function ThrowingChild(): JSX.Element {
  throw new Error('Test error');
}

function GoodChild() {
  return <div>Working</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>
    );
    expect(screen.getByText('Working')).toBeInTheDocument();
  });

  it('renders fallback on error', () => {
    // Suppress console.error from React error boundary
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary name="Visualizer">
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(screen.getByText('Visualizer error')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();

    spy.mockRestore();
  });

  it('renders custom fallback on error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom fallback')).toBeInTheDocument();

    spy.mockRestore();
  });

  it('recovers when Try again is clicked', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;

    function MaybeThrow() {
      if (shouldThrow) throw new Error('Recoverable');
      return <div>Recovered</div>;
    }

    render(
      <ErrorBoundary name="Recovery">
        <MaybeThrow />
      </ErrorBoundary>
    );

    expect(screen.getByText('Recoverable')).toBeInTheDocument();

    // Stop throwing, then click retry
    shouldThrow = false;
    fireEvent.click(screen.getByText('Try again'));

    expect(screen.getByText('Recovered')).toBeInTheDocument();

    spy.mockRestore();
  });
});
