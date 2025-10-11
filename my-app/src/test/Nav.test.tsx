import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock dependencies BEFORE imports
const mockNavigate = jest.fn();
const mockLocation = { pathname: '/test', search: '', hash: '', state: null, key: 'default' };
const mockFetchSubscription = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
  BrowserRouter: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('../services/api', () => ({
  fetchSubscription: (...args: any[]) => mockFetchSubscription(...args),
}));

jest.mock('../auth/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../components/SupportPanel', () => {
  return function MockSupportPanel({ onClose }: any) {
    return (
      <div data-testid="support-panel">
        <button onClick={onClose}>Close Support</button>
      </div>
    );
  };
});

// Now import the component
import Navbar from '../components/Nav';
import { BrowserRouter } from 'react-router-dom';

// Helper to render with router
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('Navbar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Rendering', () => {
    it('should render logo and company name', () => {
      mockUseAuth.mockReturnValue({ user: null });

      renderWithRouter(<Navbar />);

      expect(screen.getByText('Quality for Outcomes')).toBeInTheDocument();
      expect(screen.getByAltText('Logo')).toBeInTheDocument();
    });

    it('should not show menu when user is not logged in', () => {
      mockUseAuth.mockReturnValue({ user: null });

      renderWithRouter(<Navbar />);

      const hamburger = document.querySelector('.hamburger');
      expect(hamburger).not.toBeInTheDocument();
    });

    it('should show hamburger menu when user is logged in', () => {
      mockUseAuth.mockReturnValue({ 
        user: { email: 'test@example.com', userId: '1' } 
      });

      renderWithRouter(<Navbar />);

      const hamburger = document.querySelector('.hamburger');
      expect(hamburger).toBeInTheDocument();
    });
  });

  describe('Subscription Fetching', () => {
    it('should fetch subscription when user is logged in', async () => {
      mockUseAuth.mockReturnValue({ 
        user: { email: 'test@example.com', userId: '1' } 
      });
      mockFetchSubscription.mockResolvedValue({
        success: true,
        data: {
          subscriptionId: 'sub_123',
          email: 'test@example.com',
          planId: 'price_pro_monthly',
          status: 'active',
          startDate: '2024-01-01',
          renewalDate: '2024-02-01',
          expiresAt: null,
          autoRenew: true,
          updatedAt: '2024-01-01',
        },
      });

      renderWithRouter(<Navbar />);

      await waitFor(() => {
        expect(mockFetchSubscription).toHaveBeenCalledTimes(1);
      });
    });

    it('should not fetch subscription when user is not logged in', () => {
      mockUseAuth.mockReturnValue({ user: null });

      renderWithRouter(<Navbar />);

      expect(mockFetchSubscription).not.toHaveBeenCalled();
    });

    it('should handle subscription fetch error gracefully', async () => {
      mockUseAuth.mockReturnValue({ 
        user: { email: 'test@example.com', userId: '1' } 
      });
      mockFetchSubscription.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      renderWithRouter(<Navbar />);

      await waitFor(() => {
        expect(mockFetchSubscription).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Menu Interaction', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ 
        user: { email: 'test@example.com', userId: '1' } 
      });
      mockFetchSubscription.mockResolvedValue({
        success: true,
        data: null,
      });
    });

    it('should toggle menu when hamburger is clicked', async () => {
      renderWithRouter(<Navbar />);

      await waitFor(() => {
        expect(mockFetchSubscription).toHaveBeenCalled();
      });

      const hamburger = document.querySelector('.hamburger') as HTMLElement;
      const menuContent = document.querySelector('.menu-content');

      // Initially closed
      expect(menuContent).not.toHaveClass('visible');

      // Open menu
      fireEvent.click(hamburger);
      expect(menuContent).toHaveClass('visible');

      // Close menu
      fireEvent.click(hamburger);
      expect(menuContent).not.toHaveClass('visible');
    });

    it('should show Dashboard, Profile, and Logout links', async () => {
      renderWithRouter(<Navbar />);

      await waitFor(() => {
        expect(mockFetchSubscription).toHaveBeenCalled();
      });

      const hamburger = document.querySelector('.hamburger') as HTMLElement;
      fireEvent.click(hamburger);

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Profile')).toBeInTheDocument();
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    it('should close menu when clicking outside', async () => {
      renderWithRouter(<Navbar />);

      await waitFor(() => {
        expect(mockFetchSubscription).toHaveBeenCalled();
      });

      const hamburger = document.querySelector('.hamburger') as HTMLElement;
      fireEvent.click(hamburger);

      const menuContent = document.querySelector('.menu-content');
      expect(menuContent).toHaveClass('visible');

      // Click outside
      fireEvent.mouseDown(document.body);

      await waitFor(() => {
        expect(menuContent).not.toHaveClass('visible');
      });
    });
  });

  describe('Support Access Control', () => {
    it('should not show Support button for free users', async () => {
      mockUseAuth.mockReturnValue({ 
        user: { email: 'test@example.com', userId: '1' } 
      });
      mockFetchSubscription.mockResolvedValue({
        success: true,
        data: {
          subscriptionId: 'sub_123',
          email: 'test@example.com',
          planId: 'price_free',
          status: 'active',
          startDate: '2024-01-01',
          renewalDate: '2024-02-01',
          expiresAt: null,
          autoRenew: true,
          updatedAt: '2024-01-01',
        },
      });

      renderWithRouter(<Navbar />);

      await waitFor(() => {
        expect(mockFetchSubscription).toHaveBeenCalled();
      });

      const hamburger = document.querySelector('.hamburger') as HTMLElement;
      fireEvent.click(hamburger);

      expect(screen.queryByText('Support')).not.toBeInTheDocument();
    });

    it('should show Support button for pro users', async () => {
      mockUseAuth.mockReturnValue({ 
        user: { email: 'test@example.com', userId: '1' } 
      });
      mockFetchSubscription.mockResolvedValue({
        success: true,
        data: {
          subscriptionId: 'sub_123',
          email: 'test@example.com',
          planId: 'price_pro_monthly',
          status: 'active',
          startDate: '2024-01-01',
          renewalDate: '2024-02-01',
          expiresAt: null,
          autoRenew: true,
          updatedAt: '2024-01-01',
        },
      });

      renderWithRouter(<Navbar />);

      await waitFor(() => {
        expect(mockFetchSubscription).toHaveBeenCalled();
      });

      const hamburger = document.querySelector('.hamburger') as HTMLElement;
      fireEvent.click(hamburger);

      expect(screen.getByText('Support')).toBeInTheDocument();
    });

    it('should show Support button for premium users', async () => {
      mockUseAuth.mockReturnValue({ 
        user: { email: 'test@example.com', userId: '1' } 
      });
      mockFetchSubscription.mockResolvedValue({
        success: true,
        data: {
          subscriptionId: 'sub_123',
          email: 'test@example.com',
          planId: 'price_premium_monthly',
          status: 'active',
          startDate: '2024-01-01',
          renewalDate: '2024-02-01',
          expiresAt: null,
          autoRenew: true,
          updatedAt: '2024-01-01',
        },
      });

      renderWithRouter(<Navbar />);

      await waitFor(() => {
        expect(mockFetchSubscription).toHaveBeenCalled();
      });

      const hamburger = document.querySelector('.hamburger') as HTMLElement;
      fireEvent.click(hamburger);

      expect(screen.getByText('Support')).toBeInTheDocument();
    });

    it('should open support panel when Support is clicked', async () => {
      mockUseAuth.mockReturnValue({ 
        user: { email: 'test@example.com', userId: '1' } 
      });
      mockFetchSubscription.mockResolvedValue({
        success: true,
        data: {
          subscriptionId: 'sub_123',
          email: 'test@example.com',
          planId: 'price_pro_monthly',
          status: 'active',
          startDate: '2024-01-01',
          renewalDate: '2024-02-01',
          expiresAt: null,
          autoRenew: true,
          updatedAt: '2024-01-01',
        },
      });

      renderWithRouter(<Navbar />);

      await waitFor(() => {
        expect(mockFetchSubscription).toHaveBeenCalled();
      });

      const hamburger = document.querySelector('.hamburger') as HTMLElement;
      fireEvent.click(hamburger);

      const supportButton = screen.getByText('Support');
      fireEvent.click(supportButton);

      expect(screen.getByTestId('support-panel')).toBeInTheDocument();
    });

    it('should close menu when Support button is clicked', async () => {
      mockUseAuth.mockReturnValue({ 
        user: { email: 'test@example.com', userId: '1' } 
      });
      mockFetchSubscription.mockResolvedValue({
        success: true,
        data: {
          subscriptionId: 'sub_123',
          email: 'test@example.com',
          planId: 'price_pro_monthly',
          status: 'active',
          startDate: '2024-01-01',
          renewalDate: '2024-02-01',
          expiresAt: null,
          autoRenew: true,
          updatedAt: '2024-01-01',
        },
      });

      renderWithRouter(<Navbar />);

      await waitFor(() => {
        expect(mockFetchSubscription).toHaveBeenCalled();
      });

      const hamburger = document.querySelector('.hamburger') as HTMLElement;
      fireEvent.click(hamburger);

      const menuContent = document.querySelector('.menu-content');
      expect(menuContent).toHaveClass('visible');

      const supportButton = screen.getByText('Support');
      fireEvent.click(supportButton);

      expect(menuContent).not.toHaveClass('visible');
    });
  });

  describe('Plan Detection', () => {
    it('should detect free plan correctly', async () => {
      mockUseAuth.mockReturnValue({ 
        user: { email: 'test@example.com', userId: '1' } 
      });
      mockFetchSubscription.mockResolvedValue({
        success: true,
        data: {
          subscriptionId: 'sub_123',
          email: 'test@example.com',
          planId: 'price_free',
          status: 'active',
          startDate: '2024-01-01',
          renewalDate: '2024-02-01',
          expiresAt: null,
          autoRenew: true,
          updatedAt: '2024-01-01',
        },
      });

      renderWithRouter(<Navbar />);

      await waitFor(() => {
        expect(mockFetchSubscription).toHaveBeenCalled();
      });

      const hamburger = document.querySelector('.hamburger') as HTMLElement;
      fireEvent.click(hamburger);

      expect(screen.queryByText('Support')).not.toBeInTheDocument();
    });

    it('should default to free plan when no subscription data', async () => {
      mockUseAuth.mockReturnValue({ 
        user: { email: 'test@example.com', userId: '1' } 
      });
      mockFetchSubscription.mockResolvedValue({
        success: true,
        data: null,
      });

      renderWithRouter(<Navbar />);

      await waitFor(() => {
        expect(mockFetchSubscription).toHaveBeenCalled();
      });

      const hamburger = document.querySelector('.hamburger') as HTMLElement;
      fireEvent.click(hamburger);

      expect(screen.queryByText('Support')).not.toBeInTheDocument();
    });
  });
});