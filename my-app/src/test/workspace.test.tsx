import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// Mock dependencies BEFORE imports
const mockNavigate = jest.fn();
const mockLocation = { pathname: '/projects', search: '', hash: '', state: null, key: 'default' };

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
  BrowserRouter: ({ children }: any) => <div>{children}</div>,
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

// Mock API services
const mockCreateTocProject = jest.fn();
const mockFetchUserTocs = jest.fn();
const mockFetchSubscription = jest.fn();

jest.mock("../services/api", () => ({
  createTocProject: (...args: any[]) => mockCreateTocProject(...args),
  fetchUserTocs: (...args: any[]) => mockFetchUserTocs(...args),
  fetchSubscription: (...args: any[]) => mockFetchSubscription(...args),
}));

jest.mock('../utils/exportUtils', () => ({
  exportVisualDiagram: jest.fn(),
}));

// Now import components
import ProjectsPage from "../pages/Project";
import FormPanel from "../components/FormPanel";
import VisualPanel from "../components/VisualPanel";

describe("ProjectsPage Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
    localStorage.clear();
    localStorage.setItem("userId", "test-user-123");
    
    // Default mock for subscription - free user
    mockFetchSubscription.mockResolvedValue({
      success: true,
      data: null,
    });
  });

  describe("Initial Rendering", () => {
    test("renders workspace heading", async () => {
      mockFetchUserTocs.mockResolvedValue({
        success: true,
        data: { projects: [] },
        message: "",
      });

      render(<ProjectsPage />);
      expect(screen.getByRole("heading", { name: /workspace/i })).toBeInTheDocument();
    });

    test("shows loading spinner while fetching projects", () => {
      mockFetchUserTocs.mockImplementation(() => new Promise(() => {}));
      mockFetchSubscription.mockImplementation(() => new Promise(() => {}));
      
      render(<ProjectsPage />);
      expect(screen.getByText(/loading projects/i)).toBeInTheDocument();
    });

    test("displays empty state when no projects exist", async () => {
      mockFetchUserTocs.mockResolvedValue({
        success: true,
        data: { projects: [] },
        message: "",
      });

      render(<ProjectsPage />);
      await waitFor(() => {
        expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
      });
    });

    test("displays project list when projects exist", async () => {
      mockFetchUserTocs.mockResolvedValue({
        success: true,
        data: {
          projects: [
            { projectId: "1", projectName: "Project 1" },
            { projectId: "2", projectName: "Project 2" },
          ],
        },
        message: "",
      });

      render(<ProjectsPage />);
      await waitFor(() => {
        expect(screen.getByText("Project 1")).toBeInTheDocument();
        expect(screen.getByText("Project 2")).toBeInTheDocument();
      });
    });

    test("displays plan information", async () => {
      mockFetchUserTocs.mockResolvedValue({
        success: true,
        data: { projects: [] },
        message: "",
      });

      render(<ProjectsPage />);
      
      await waitFor(() => {
        expect(screen.getByText(/free plan/i)).toBeInTheDocument();
        expect(screen.getByText(/0 \/ 3 projects/i)).toBeInTheDocument();
      });
    });
  });

  describe("Create Project Form", () => {
    test("opens and closes create project form", async () => {
      mockFetchUserTocs.mockResolvedValue({
        success: true,
        data: { projects: [] },
        message: "",
      });

      render(<ProjectsPage />);
      await waitFor(() => screen.getByRole("button", { name: /create project/i }));

      const createBtn = screen.getByRole("button", { name: /create project/i });
      fireEvent.click(createBtn);

      expect(screen.getByPlaceholderText(/project name/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^save$/i })).toBeInTheDocument();

      const cancelBtn = screen.getByRole("button", { name: /cancel/i });
      fireEvent.click(cancelBtn);

      expect(screen.queryByPlaceholderText(/project name/i)).not.toBeInTheDocument();
    });

    test("auto-focuses input when form opens", async () => {
      mockFetchUserTocs.mockResolvedValue({
        success: true,
        data: { projects: [] },
        message: "",
      });

      render(<ProjectsPage />);
      await waitFor(() => screen.getByRole("button", { name: /create project/i }));

      fireEvent.click(screen.getByRole("button", { name: /create project/i }));
      const input = screen.getByPlaceholderText(/project name/i);
      
      expect(document.activeElement).toBe(input);
    });
  });

  describe("Project Name Validation", () => {
    beforeEach(async () => {
      mockFetchUserTocs.mockResolvedValue({
        success: true,
        data: { projects: [] },
        message: "",
      });
      render(<ProjectsPage />);
      await waitFor(() => screen.getByRole("button", { name: /create project/i }));
      fireEvent.click(screen.getByRole("button", { name: /create project/i }));
    });

    test("shows error for empty project name", async () => {
      const input = screen.getByPlaceholderText(/project name/i);
      const saveBtn = screen.getByRole("button", { name: /^save$/i });
      
      expect(saveBtn).toBeDisabled();
      
      await userEvent.type(input, "a");
      await userEvent.clear(input);
      
      expect(saveBtn).toBeDisabled();
    });

    test("shows error for project name with only spaces", async () => {
      const input = screen.getByPlaceholderText(/project name/i);
      await userEvent.type(input, "   ");
      
      const saveBtn = screen.getByRole("button", { name: /^save$/i });
      expect(saveBtn).toBeDisabled();
    });

    test("shows error for project name less than 3 characters", async () => {
      const input = screen.getByPlaceholderText(/project name/i);
      await userEvent.type(input, "AB");
      
      const saveBtn = screen.getByRole("button", { name: /^save$/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText(/must be at least 3 characters/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    test("shows error for project name over 100 characters", async () => {
      const input = screen.getByPlaceholderText(/project name/i);
      await userEvent.type(input, "A".repeat(101));
      
      const saveBtn = screen.getByRole("button", { name: /^save$/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText(/must be less than 100 characters/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    test("shows error for invalid characters", async () => {
      const input = screen.getByPlaceholderText(/project name/i);
      await userEvent.type(input, "Project@#$%");
      
      const saveBtn = screen.getByRole("button", { name: /^save$/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText(/invalid characters/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    test("accepts valid project name with spaces, hyphens, and underscores", async () => {
      mockCreateTocProject.mockResolvedValue({
        success: true,
        data: {
          projectId: "new-id",
          tocData: { projectTitle: "Valid Project-Name_123" },
        },
        message: "",
      });

      const input = screen.getByPlaceholderText(/project name/i);
      await userEvent.type(input, "Valid Project-Name_123");
      
      const saveBtn = screen.getByRole("button", { name: /^save$/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockCreateTocProject).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    test("clears validation error when user starts typing", async () => {
      const input = screen.getByPlaceholderText(/project name/i);
      const saveBtn = screen.getByRole("button", { name: /^save$/i });
      
      await userEvent.type(input, "AB");
      fireEvent.click(saveBtn);
      
      const errorMessage = await screen.findByText(/must be at least 3 characters/i, {}, { timeout: 3000 });
      expect(errorMessage).toBeInTheDocument();

      await userEvent.type(input, "C Valid Project");
      
      await waitFor(() => {
        expect(screen.queryByText(/must be at least 3 characters/i)).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe("Project Creation", () => {
    test("creates project successfully and navigates", async () => {
      mockFetchUserTocs.mockResolvedValue({
        success: true,
        data: { projects: [] },
        message: "",
      });

      mockCreateTocProject.mockResolvedValue({
        success: true,
        data: {
          projectId: "new-project-123",
          tocData: { projectTitle: "New Project" },
        },
        message: "",
      });

      render(<ProjectsPage />);
      await waitFor(() => screen.getByRole("button", { name: /create project/i }));

      fireEvent.click(screen.getByRole("button", { name: /create project/i }));
      const input = screen.getByPlaceholderText(/project name/i);
      await userEvent.type(input, "New Project");
      
      const saveBtn = screen.getByRole("button", { name: /^save$/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockCreateTocProject).toHaveBeenCalledWith({
          userId: "test-user-123",
          projectTitle: "New Project",
          status: "draft",
        });
        expect(mockNavigate).toHaveBeenCalledWith("/projects/new-project-123");
      }, { timeout: 2000 });
    });

    test("trims whitespace before creating project", async () => {
      mockFetchUserTocs.mockResolvedValue({
        success: true,
        data: { projects: [] },
        message: "",
      });

      mockCreateTocProject.mockResolvedValue({
        success: true,
        data: {
          projectId: "new-id",
          tocData: { projectTitle: "Trimmed" },
        },
        message: "",
      });

      render(<ProjectsPage />);
      await waitFor(() => screen.getByRole("button", { name: /create project/i }));

      fireEvent.click(screen.getByRole("button", { name: /create project/i }));
      const input = screen.getByPlaceholderText(/project name/i);
      await userEvent.type(input, "  Trimmed  ");
      
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

      await waitFor(() => {
        expect(mockCreateTocProject).toHaveBeenCalledWith({
          userId: "test-user-123",
          projectTitle: "Trimmed",
          status: "draft",
        });
      }, { timeout: 2000 });
    });

    test("shows loading state while creating project", async () => {
      mockFetchUserTocs.mockResolvedValue({
        success: true,
        data: { projects: [] },
        message: "",
      });

      mockCreateTocProject.mockImplementation(() => new Promise(() => {}));

      render(<ProjectsPage />);
      await waitFor(() => screen.getByRole("button", { name: /create project/i }));

      fireEvent.click(screen.getByRole("button", { name: /create project/i }));
      const input = screen.getByPlaceholderText(/project name/i);
      await userEvent.type(input, "New Project");
      
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

      await waitFor(() => {
        expect(screen.getByText(/creating/i)).toBeInTheDocument();
      });
    });

    test("handles API error during creation", async () => {
      mockFetchUserTocs.mockResolvedValue({
        success: true,
        data: { projects: [] },
        message: "",
      });

      mockCreateTocProject.mockRejectedValue({
        response: { data: { message: "Server error" } },
      });

      render(<ProjectsPage />);
      await waitFor(() => screen.getByRole("button", { name: /create project/i }));

      fireEvent.click(screen.getByRole("button", { name: /create project/i }));
      const input = screen.getByPlaceholderText(/project name/i);
      await userEvent.type(input, "New Project");
      
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe("Subscription and Plan Limits", () => {
    test("shows upgrade modal when free user reaches project limit", async () => {
      mockFetchUserTocs.mockResolvedValue({
        success: true,
        data: {
          projects: [
            { projectId: "1", projectName: "Project 1" },
            { projectId: "2", projectName: "Project 2" },
            { projectId: "3", projectName: "Project 3" },
          ],
        },
        message: "",
      });

      render(<ProjectsPage />);
      await waitFor(() => screen.getByRole("button", { name: /create project/i }));

      const createBtn = screen.getByRole("button", { name: /create project/i });
      
      // The button should NOT be disabled - button is always enabled
      expect(createBtn).not.toBeDisabled();
      
      // Click the button - based on actual behavior, it opens the form
      fireEvent.click(createBtn);
      
      // The form opens (this is the actual behavior based on the rendered output)
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/project name/i)).toBeInTheDocument();
      });
      
      // Now try to create a project - this should show the modal
      const input = screen.getByPlaceholderText(/project name/i);
      await userEvent.type(input, "New Project");
      
      const saveBtn = screen.getByRole("button", { name: /^save$/i });
      fireEvent.click(saveBtn);
      
      // The modal should appear when trying to save
      await waitFor(() => {
        expect(screen.getByText(/project limit reached/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    test("pro users can create up to 7 projects", async () => {
      mockFetchSubscription.mockResolvedValue({
        success: true,
        data: {
          subscriptionId: "sub_123",
          email: "test@example.com",
          planId: "price_pro_monthly",
          status: "active",
          startDate: "2024-01-01",
          renewalDate: "2024-02-01",
          expiresAt: null,
          autoRenew: true,
          updatedAt: "2024-01-01",
        },
      });

      mockFetchUserTocs.mockResolvedValue({
        success: true,
        data: { projects: [] },
        message: "",
      });

      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText(/pro plan/i)).toBeInTheDocument();
        expect(screen.getByText(/0 \/ 7 projects/i)).toBeInTheDocument();
      });
    });

    test("premium users have unlimited projects", async () => {
      mockFetchSubscription.mockResolvedValue({
        success: true,
        data: {
          subscriptionId: "sub_123",
          email: "test@example.com",
          planId: "price_premium_monthly",
          status: "active",
          startDate: "2024-01-01",
          renewalDate: "2024-02-01",
          expiresAt: null,
          autoRenew: true,
          updatedAt: "2024-01-01",
        },
      });

      mockFetchUserTocs.mockResolvedValue({
        success: true,
        data: { projects: [] },
        message: "",
      });

      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText(/premium plan/i)).toBeInTheDocument();
        expect(screen.getByText(/0 \/ ∞ projects/i)).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    test("shows error banner when fetching projects fails", async () => {
      mockFetchUserTocs.mockRejectedValue({
        response: { data: { message: "Network error" } },
      });

      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    test("can dismiss error banner", async () => {
      mockFetchUserTocs.mockRejectedValue({
        response: { data: { message: "Network error" } },
      });

      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      const closeBtn = screen.getByRole("button", { name: /×/i });
      fireEvent.click(closeBtn);

      expect(screen.queryByText(/network error/i)).not.toBeInTheDocument();
    });
  });

  describe("Opening Projects", () => {
    test("navigates to project when Open button clicked", async () => {
      mockFetchUserTocs.mockResolvedValue({
        success: true,
        data: {
          projects: [{ projectId: "project-123", projectName: "Test Project" }],
        },
        message: "",
      });

      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText("Test Project")).toBeInTheDocument();
      });

      const openBtn = screen.getByRole("button", { name: /open/i });
      fireEvent.click(openBtn);

      expect(localStorage.getItem("projectId")).toBe("project-123");
      expect(mockNavigate).toHaveBeenCalledWith("/projects/project-123");
    });
  });
});

describe("FormPanel Component", () => {
  const mockData = {
    projectTitle: "Test Project",
    goal: "",
    aim: "",
    beneficiaries: "",
    activities: "",
    objectives: "",
    externalInfluences: "",
  };

  const mockUpdateField = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders all form fields", () => {
    render(<FormPanel data={mockData} updateField={mockUpdateField} />);

    expect(screen.getByText(/identify big-picture goal/i)).toBeInTheDocument();
    expect(screen.getByText(/define project aim/i)).toBeInTheDocument();
    expect(screen.getByText(/define project beneficiaries/i)).toBeInTheDocument();
    expect(screen.getByText(/define project activities/i)).toBeInTheDocument();
    expect(screen.getByText(/define project objectives/i)).toBeInTheDocument();
    expect(screen.getByText(/external influences/i)).toBeInTheDocument();
  });

  test("updates field when user types", async () => {
    render(<FormPanel data={mockData} updateField={mockUpdateField} />);

    const goalInput = screen.getByPlaceholderText(/enter goal/i);
    await userEvent.type(goalInput, "Test goal");

    expect(mockUpdateField).toHaveBeenCalled();
  });

  test("calculates progress correctly", () => {
    const filledData = {
      ...mockData,
      goal: '["Goal 1"]',
      aim: '["Aim 1"]',
      beneficiaries: "Beneficiaries",
    };

    render(<FormPanel data={filledData} updateField={mockUpdateField} />);
    expect(screen.getByText(/50% completed/i)).toBeInTheDocument();
  });

  test("toggles sidebar open/close", () => {
    render(<FormPanel data={mockData} updateField={mockUpdateField} />);

    expect(screen.getByRole("button", { name: /←/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /←/i }));
    expect(screen.getByRole("button", { name: /→/i })).toBeInTheDocument();
  });
});

describe("VisualPanel Component", () => {
  const mockData = {
    projectTitle: "Test Project",
    goal: '["Goal 1"]',
    aim: '["Aim 1"]',
    beneficiaries: "Beneficiaries",
    activities: '["Activity 1"]',
    objectives: '["Objective 1"]',
    externalInfluences: '["Influence 1"]',
  };

  const mockUpdateField = jest.fn();
  const mockUpdateColumnColors = jest.fn();
  const mockUpdateCloudColors = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders all columns", () => {
    render(
      <VisualPanel
        data={mockData}
        updateField={mockUpdateField}
        updateColumnColors={mockUpdateColumnColors}
        updateCloudColors={mockUpdateCloudColors}
      />
    );

    expect(screen.getByText("Activities")).toBeInTheDocument();
    expect(screen.getByText("Objectives")).toBeInTheDocument();
    expect(screen.getByText("Aim")).toBeInTheDocument();
    expect(screen.getByText("Goal")).toBeInTheDocument();
  });

  test("renders external influences", () => {
    render(
      <VisualPanel
        data={mockData}
        updateField={mockUpdateField}
        updateColumnColors={mockUpdateColumnColors}
        updateCloudColors={mockUpdateCloudColors}
      />
    );

    expect(screen.getByText("External Influences")).toBeInTheDocument();
  });

  test("toggles customize mode", () => {
    render(
      <VisualPanel
        data={mockData}
        updateField={mockUpdateField}
        updateColumnColors={mockUpdateColumnColors}
        updateCloudColors={mockUpdateCloudColors}
      />
    );

    // British spelling: "Customise"
    const customizeBtn = screen.getByRole("button", { name: /customise/i });
    fireEvent.click(customizeBtn);

    expect(screen.getByText(/hide customisation/i)).toBeInTheDocument();
  });

  test("prevents adding more than 10 cards", async () => {
    const maxData = {
      ...mockData,
      activities: JSON.stringify(Array(10).fill("Activity")),
    };

    render(
      <VisualPanel
        data={maxData}
        updateField={mockUpdateField}
        updateColumnColors={mockUpdateColumnColors}
        updateCloudColors={mockUpdateCloudColors}
      />
    );

    // British spelling: "Customise"
    const customizeBtn = screen.getByRole("button", { name: /customise/i });
    fireEvent.click(customizeBtn);
    
    await waitFor(() => {
      expect(screen.getByText(/hide customisation/i)).toBeInTheDocument();
    });
    
    const addButtons = screen.getAllByRole("button", { name: /\+/i });
    const cardAddButtons = addButtons.filter(btn => {
      const parent = btn.closest('.add-remove-wrapper');
      return parent !== null;
    });
    
    fireEvent.click(cardAddButtons[0]);

    const toastMessage = await screen.findByText(
      /maximum 10 cards per column/i,
      {},
      { timeout: 3000 }
    );
    
    expect(toastMessage).toBeInTheDocument();
    
    const toastContainer = toastMessage.closest('.toast-notification');
    expect(toastContainer).toHaveClass('toast-warning');
  });
});