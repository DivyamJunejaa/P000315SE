import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TermsManagement from '../features/admin/TermsManagement.jsx';

vi.mock('../components/RichTextEditor', () => ({
  default: ({ value, onChange }) => (
    <textarea aria-label="Rich Editor" value={value} onChange={(e) => onChange(e.target.value)} />
  )
}));

vi.mock('../features/admin/api/termsApi.js', async () => {
  const actual = await vi.importActual('../features/admin/api/termsApi.js');
  return {
    ...actual,
    fetchTerms: vi.fn().mockResolvedValue({
      content: 'Initial valid terms ' + 'y'.repeat(60),
      updatedAt: '2024-01-01T00:00:00Z',
      version: 1,
    }),
    updateTerms: vi.fn().mockResolvedValue({ success: true }),
  };
});

const qc = new QueryClient();

describe('TermsManagement message clearing', () => {
  test('clears previous message when typing after an error', async () => {
    render(
      <QueryClientProvider client={qc}>
        <TermsManagement />
      </QueryClientProvider>
    );

    // Switch to Plain Text editor to exercise handleContentChange
    const plainToggle = await screen.findByTitle(/Plain Text Editor/i);
    fireEvent.click(plainToggle);

    const editor = await screen.findByLabelText(/Terms and Conditions Content/i);

    // Make content invalid (short) and attempt to save to trigger error message
    fireEvent.change(editor, { target: { value: '' } });
    fireEvent.change(editor, { target: { value: 'too short' } });
    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    // Error message appears
    const err = await screen.findByText(/Cannot save:/i);
    expect(err).toBeInTheDocument();

    // Type again to clear message via handleContentChange
    fireEvent.change(editor, { target: { value: 'too short now making changes' } });

    // Message should disappear
    expect(screen.queryByText(/Cannot save:/i)).toBeNull();
  });
});