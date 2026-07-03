import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import './i18n';
import App from './App';

describe('App', () => {
  it('renders the dashboard heading in Hebrew', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'שנות מס' })).toBeTruthy();
  });
});
