import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TermsManagement from '../features/admin/TermsManagement.jsx';

// Mock the RichTextEditor to a simple textarea
vi.mock('../components/RichTextEditor', () => ({
  default: ({ value, onChange }) => (
    <textarea id="terms-content" value={value} onChange={(e) => onChange(e.target.value)} />
  )
}));

// Partially mock termsApi: keep validation, stub fetch/update
vi.mock('../features/admin/api/termsApi.js', async () => {
  const actual = await vi.importActual('../features/admin/api/termsApi.js');
  return {
    ...actual,
    fetchTerms: vi.fn(),
    updateTerms: vi.fn(),
  };
});

import { fetchTerms, updateTerms } from '../features/admin/api/termsApi.js';

describe('TermsManagement (extras)', () => {
  beforeEach(() => {
    fetchTerms.mockResolvedValue({
      content: 'Initial terms content ' + 'x'.repeat(60),
      updatedAt: '2024-01-01T00:00:00Z',
      version: 1,
    });
    updateTerms.mockResolvedValue({
      content: 'Updated terms content ' + 'y'.repeat(60),
      updatedAt: '2024-01-01T00:00:00Z',
      version: 1,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('toggle to plain editor updates label', async () => {
    render(<TermsManagement />);
    await screen.findByLabelText(/Terms and Conditions Content/);

    const plainBtn = screen.getByTitle('Plain Text Editor');
    fireEvent.click(plainBtn);

    expect(screen.getByText(/Plain Text\)/)).toBeInTheDocument();
  });

  test('Save button is disabled when there are no changes', async () => {
    render(<TermsManagement />);
    await screen.findByLabelText(/Terms and Conditions Content/);
    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    expect(saveBtn).toBeDisabled();
  });

  test('shows validation warnings for short content without legal terms', async () => {
    render(<TermsManagement />);
    await screen.findByLabelText(/Terms and Conditions Content/);

    const plainBtn = screen.getByTitle('Plain Text Editor');
    fireEvent.click(plainBtn);
    const editor = screen.getByLabelText(/Terms and Conditions Content/);

    const shortContent = 'Short content here'; // < 100 chars and no common terms
    fireEvent.change(editor, { target: { value: shortContent } });

    // Warnings block renders
    expect(await screen.findByText(/Warnings:/)).toBeInTheDocument();
    expect(screen.getByText(/seems quite short/i)).toBeInTheDocument();
    expect(screen.getByText(/common legal terminology/i)).toBeInTheDocument();
  });

  test('Ctrl+S (Cmd+S) triggers save in plain mode when valid', async () => {
    render(<TermsManagement />);
    await screen.findByLabelText(/Terms and Conditions Content/);

    // Switch to plain textarea to exercise onKeyDown
    fireEvent.click(screen.getByTitle('Plain Text Editor'));
    const editor = screen.getByLabelText(/Terms and Conditions Content/);
    fireEvent.change(editor, { target: { value: 'Valid content ' + 'z'.repeat(60) } });

    // Fire metaKey+s
    fireEvent.keyDown(editor, { key: 's', metaKey: true });

    await waitFor(() => expect(updateTerms).toHaveBeenCalled());
    expect(screen.getByText('Terms and conditions updated successfully!')).toBeInTheDocument();
  });

  test('Reset Changes returns content to original and clears validation', async () => {
    render(<TermsManagement />);
    await screen.findByLabelText(/Terms and Conditions Content/);

    // Switch to plain textarea
    fireEvent.click(screen.getByTitle('Plain Text Editor'));
    const editor = screen.getByLabelText(/Terms and Conditions Content/);

    fireEvent.change(editor, { target: { value: 'Valid content ' + 'z'.repeat(60) } });
    expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument();

    // Click Reset Changes
    fireEvent.click(screen.getByText('Reset Changes'));

    // Original content restored and validation cleared
    expect(editor.value).toMatch(/Initial terms content/);
    expect(screen.queryByText(/Unsaved changes/)).not.toBeInTheDocument();
  });
});