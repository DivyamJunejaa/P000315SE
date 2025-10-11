import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SupportPanel from '../components/SupportPanel';

// Mock useNavigate
const mockNavigate = jest.fn();
const mockLocation = { pathname: '/test', search: '', hash: '', state: null, key: 'default' };

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

describe('SupportPanel Component', () => {
  const mockOnClose = jest.fn();
  const defaultProps = {
    onClose: mockOnClose,
    supportEmail: 'test@example.com',
    defaultSubject: 'Test Support',
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    mockNavigate.mockClear();
    mockOnClose.mockClear();
    
    // Clear localStorage
    localStorage.clear();
    
    // Mock window.location.href
    delete (window as any).location;
    window.location = { href: '' } as any;
  });

  describe('Access Control', () => {
    test('should render for pro users', () => {
      localStorage.setItem('userPlan', 'pro');
      
      render(<SupportPanel {...defaultProps} />);
      
      expect(screen.getByText('Contact Support')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Describe your issue in detail...')).toBeInTheDocument();
    });

    test('should render for premium users', () => {
      localStorage.setItem('userPlan', 'premium');
      
      render(<SupportPanel {...defaultProps} />);
      
      expect(screen.getByText('Contact Support')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Describe your issue in detail...')).toBeInTheDocument();
    });

    test('should redirect free users to subscription page', () => {
      localStorage.setItem('userPlan', 'free');
      
      render(<SupportPanel {...defaultProps} />);
      
      expect(mockOnClose).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/subscription');
    });

    test('should redirect when no plan in localStorage (defaults to free)', () => {
      // Don't set any plan in localStorage
      
      render(<SupportPanel {...defaultProps} />);
      
      expect(mockOnClose).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/subscription');
    });

    test('should not render for free users', () => {
      localStorage.setItem('userPlan', 'free');
      
      const { container } = render(<SupportPanel {...defaultProps} />);
      
      expect(container.firstChild).toBeNull();
    });
  });

  describe('UI Rendering', () => {
    beforeEach(() => {
      localStorage.setItem('userPlan', 'pro');
    });

    test('should display header with title and close button', () => {
      render(<SupportPanel {...defaultProps} />);
      
      expect(screen.getByText('Contact Support')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '×' })).toBeInTheDocument();
    });

    test('should display message textarea', () => {
      render(<SupportPanel {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText('Describe your issue in detail...');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute('required');
      expect(textarea).toHaveAttribute('rows', '6');
    });

    test('should display submit button', () => {
      render(<SupportPanel {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: 'Send Message' })).toBeInTheDocument();
    });

    test('should render overlay element', () => {
      const { container } = render(<SupportPanel {...defaultProps} />);
      
      const overlay = container.querySelector('.support-overlay');
      expect(overlay).toBeInTheDocument();
    });
  });

  describe('Form Interaction', () => {
    beforeEach(() => {
      localStorage.setItem('userPlan', 'pro');
    });

    test('should update message state when typing in textarea', () => {
      render(<SupportPanel {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText('Describe your issue in detail...') as HTMLTextAreaElement;
      
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      
      expect(textarea.value).toBe('Test message');
    });

    test('should not submit form with empty message', () => {
      render(<SupportPanel {...defaultProps} />);
      
      const form = screen.getByRole('button', { name: 'Send Message' }).closest('form')!;
      
      fireEvent.submit(form);
      
      // window.location.href should not be set
      expect(window.location.href).toBe('');
    });

    test('should create mailto link with correct parameters on submit', () => {
      render(<SupportPanel {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText('Describe your issue in detail...');
      const submitButton = screen.getByRole('button', { name: 'Send Message' });
      
      fireEvent.change(textarea, { target: { value: 'Help me with this issue' } });
      fireEvent.click(submitButton);
      
      expect(window.location.href).toBe(
        'mailto:test@example.com?subject=Test%20Support&body=Help%20me%20with%20this%20issue'
      );
    });

    test('should handle special characters in message', () => {
      render(<SupportPanel {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText('Describe your issue in detail...');
      const submitButton = screen.getByRole('button', { name: 'Send Message' });
      
      const specialMessage = 'Test & special characters: @#$%';
      fireEvent.change(textarea, { target: { value: specialMessage } });
      fireEvent.click(submitButton);
      
      expect(window.location.href).toContain('mailto:test@example.com');
      expect(window.location.href).toContain(encodeURIComponent(specialMessage));
    });
  });

  describe('Success State', () => {
    beforeEach(() => {
      localStorage.setItem('userPlan', 'premium');
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should show success message after submission', async () => {
      render(<SupportPanel {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText('Describe your issue in detail...');
      const submitButton = screen.getByRole('button', { name: 'Send Message' });
      
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Your message is ready!/)).toBeInTheDocument();
      });
    });

    test('should hide form when success message is shown', async () => {
      render(<SupportPanel {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText('Describe your issue in detail...');
      const submitButton = screen.getByRole('button', { name: 'Send Message' });
      
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Describe your issue in detail...')).not.toBeInTheDocument();
      });
    });

    test('should auto-close panel after 2 seconds on successful submission', async () => {
      render(<SupportPanel {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText('Describe your issue in detail...');
      const submitButton = screen.getByRole('button', { name: 'Send Message' });
      
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.click(submitButton);
      
      // Fast-forward time by 2 seconds
      jest.advanceTimersByTime(2000);
      
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('Close Functionality', () => {
    beforeEach(() => {
      localStorage.setItem('userPlan', 'pro');
    });

    test('should call onClose when close button is clicked', () => {
      render(<SupportPanel {...defaultProps} />);
      
      const closeButton = screen.getByRole('button', { name: '×' });
      fireEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    test('should call onClose when overlay is clicked', () => {
      const { container } = render(<SupportPanel {...defaultProps} />);
      
      const overlay = container.querySelector('.support-overlay')!;
      fireEvent.click(overlay);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Props Configuration', () => {
    beforeEach(() => {
      localStorage.setItem('userPlan', 'pro');
    });

    test('should use default email when not provided', () => {
      const propsWithoutEmail = {
        onClose: mockOnClose,
      };
      
      render(<SupportPanel {...propsWithoutEmail} />);
      
      const textarea = screen.getByPlaceholderText('Describe your issue in detail...');
      const submitButton = screen.getByRole('button', { name: 'Send Message' });
      
      fireEvent.change(textarea, { target: { value: 'Test' } });
      fireEvent.click(submitButton);
      
      expect(window.location.href).toContain('mailto:info@qualityoutcomes.au');
    });

    test('should use default subject when not provided', () => {
      const propsWithoutSubject = {
        onClose: mockOnClose,
        supportEmail: 'test@example.com',
      };
      
      render(<SupportPanel {...propsWithoutSubject} />);
      
      const textarea = screen.getByPlaceholderText('Describe your issue in detail...');
      const submitButton = screen.getByRole('button', { name: 'Send Message' });
      
      fireEvent.change(textarea, { target: { value: 'Test' } });
      fireEvent.click(submitButton);
      
      expect(window.location.href).toContain('subject=Support%20Request');
    });

    test('should use custom email when provided', () => {
      render(<SupportPanel {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText('Describe your issue in detail...');
      const submitButton = screen.getByRole('button', { name: 'Send Message' });
      
      fireEvent.change(textarea, { target: { value: 'Test' } });
      fireEvent.click(submitButton);
      
      expect(window.location.href).toContain('mailto:test@example.com');
    });
  });

  describe('Console Logging', () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    test('should log user plan on mount', () => {
      localStorage.setItem('userPlan', 'pro');
      
      render(<SupportPanel {...defaultProps} />);
      
      expect(consoleLogSpy).toHaveBeenCalledWith('🔍 SupportPanel - User plan:', 'pro');
    });

    test('should log when free user tries to access', () => {
      localStorage.setItem('userPlan', 'free');
      
      render(<SupportPanel {...defaultProps} />);
      
      expect(consoleLogSpy).toHaveBeenCalledWith('❌ Free user tried to access support panel - closing');
    });
  });
});