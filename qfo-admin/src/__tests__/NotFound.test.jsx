import { render, screen } from '@testing-library/react';
import NotFound from '../pages/NotFound.jsx';

describe('NotFound page', () => {
  test('renders 404 and message', () => {
    render(<NotFound />);
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText(/Page not found/i)).toBeInTheDocument();
  });
});