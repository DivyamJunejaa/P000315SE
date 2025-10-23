
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createTocProject, fetchUserTocs, fetchSubscription } from "../services/api";
import "../style/Project.css";

/**
 * Detects user tier from Stripe price ID
 * Compares against environment-configured Stripe price IDs with fallback defaults
 * @param planId - Stripe price ID (e.g., 'price_1SJP2sQTtrbKnENdbIpAzwMv')
 * @returns User tier: 'free', 'pro', or 'premium'
 */
const detectTierFromPlanId = (planId?: string | null): 'free' | 'pro' | 'premium' => {
  const id = String(planId || '').toLowerCase();
  
  // Check for explicit free plan indicators
  if (!id || id.includes('free') || id === 'price_free') return 'free';
  
  // Load Stripe price IDs from environment variables
  const PRO_ID = (process.env.REACT_APP_STRIPE_PRICE_PRO || 'price_1SJOoqQTtrbKnENdq6xX75de').toLowerCase();
  const PREMIUM_ID = (process.env.REACT_APP_STRIPE_PRICE_PREMIUM || 'price_1SJP2sQTtrbKnENdbIpAzwMv').toLowerCase();
  
  // Match against Pro or Premium price IDs
  if (id === PRO_ID || id.includes('pro')) return 'pro';
  if (id === PREMIUM_ID || id.includes('premium')) return 'premium';
  
  // Default to free tier if no match
  return 'free';
};

/**
 * Converts internal tier enum to user-facing display name
 */
const tierToDisplayName = (tier: 'free' | 'pro' | 'premium'): string => {
  if (tier === 'premium') return 'Premium Plan';
  if (tier === 'pro') return 'Pro Plan';
  return 'Free Plan';
};

// Type definitions for API responses
type Project = { projectId: string; projectName: string };

type SubscriptionData = {
  subscriptionId: string;
  email: string;
  planId: string;
  status: string;
  startDate: string;
  renewalDate: string;
  expiresAt: string | null; // Null for subscriptions without expiry
  autoRenew: boolean;
  updatedAt: string;
};

// Page: Projects — manage user projects and enforce limits by subscription tier.
// Loads subscription, lists projects, validates new project names, and creates via API.
const ProjectsPage: React.FC = () => {
  // Project state: existing projects and new title draft
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectTitle, setNewProjectTitle] = useState("");
 
 // UI state: toggle new project form, loading flags, and error messages
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string>("");
  const [validationError, setValidationError] = useState<string>("");
  
  // Subscription state for gating and upgrade prompts
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const navigate = useNavigate();

  // Get userId from localStorage (set during login)
  const userId = localStorage.getItem("userId") || "";

  /**
   * Determines user's plan tier based on subscription data
   * Handles expired subscriptions and inactive statuses
   * @returns Current active plan tier or 'free' if no active subscription
   */
  const getPlanTier = (subscriptionData: SubscriptionData | null): 'free' | 'pro' | 'premium' => {
    if (!subscriptionData) return 'free';
    
     // Inactive subscriptions default to free
    if (subscriptionData.status !== 'active') return 'free';
    
    // Check if subscription has expired
    if (subscriptionData.expiresAt) {
      const expiryDate = new Date(subscriptionData.expiresAt);
      if (expiryDate < new Date()) return 'free';
    }
    return detectTierFromPlanId(subscriptionData.planId);
  };

  /**
   * Returns project limit based on plan tier
   * Free: 3 projects | Pro: 7 projects | Premium: Unlimited
   */
  const getProjectLimit = (planId: string): number => {
    const tier = detectTierFromPlanId(planId);
    if (tier === 'free') return 3;
    if (tier === 'pro') return 7;
    if (tier === 'premium') return Infinity;
    return 3;
  };

  /**
   * Gets user-facing plan name without "Plan" suffix
   * Used for UI display (e.g., "Pro" instead of "Pro Plan")
   */
  const getPlanName = (planId?: string): string => {
    const tier = detectTierFromPlanId(planId || '');
    return tierToDisplayName(tier).replace(' Plan', '');
  };

  /**
   * Fetches subscription from API and persists to localStorage
   * CRITICAL: This function stores subscription data in multiple localStorage keys
   * for performance optimization and quick access across components
   * 
   * localStorage keys set:
   * - 'subscriptionData': Full subscription object (JSON stringified)
   * - 'userPlan': Plan tier string ('free' | 'pro' | 'premium')
   * - 'planId': Stripe price ID for direct comparisons
   */ 
  const loadSubscription = async () => {
    try {
       const result = await fetchSubscription();

      if (result.success && result.data) {
         setSubscription(result.data);
        
        // Persist full subscription for reuse across app
        localStorage.setItem('subscriptionData', JSON.stringify(result.data));
        
        // STORE PLAN ID FOR STRIPE OPERATIONS
        const planTier = getPlanTier(result.data);
        localStorage.setItem('userPlan', planTier);
        
        // STORE PLAN ID
        localStorage.setItem('planId', result.data.planId);
        
        
      } else {
        // No subscription found - treat as free tier user
        setSubscription(null);
        
        // STORE NULL SUBSCRIPTION STATUS
        localStorage.setItem('subscriptionData', JSON.stringify(null));
        localStorage.setItem('userPlan', 'free');
        localStorage.removeItem('planId');
      }
    } catch (err) {
       // On error, fail gracefully to free tier
      setSubscription(null);
      localStorage.setItem('userPlan', 'free');
      localStorage.removeItem('planId');
    }
  };

  /**
   * Load user projects and subscription data on component mount
   * Uses Promise.all for parallel fetching to improve load time
   */
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError("");
      try {
        // Fetch projects and subscription in parallel for performance
        await Promise.all([
          loadSubscription(),
          (async () => {
            const res = await fetchUserTocs();
            if (res.success && res.data?.projects) {
              setProjects(res.data.projects);
            } else {
              setProjects([]); // No projects found
            }
          })(),
        ]);
      } catch (err: any) {
        console.error("Failed to load data", err);
        setError(err.response?.data?.message || err.message || "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []); // Empty dependency array

  /**
   * Checks if user can create additional projects based on plan limits
   * @returns true if user has not reached their plan's project limit
   */
  const canCreateProject = (): boolean => {
    const planId = subscription?.planId || "free";
    const limit = getProjectLimit(planId);
    return projects.length < limit;
  };

  /**
   * Validates project title against multiple criteria
   * Sets validationError state if validation fails
   * 
   * Validation rules:
   * - Not empty after trimming
   * - Minimum 3 characters
   * - Maximum 100 characters
   * - Only alphanumeric, spaces, hyphens, underscores, apostrophes, and periods
   * - No duplicate names (case-insensitive)
   * 
   * @returns true if valid, false otherwise
   */
  const validateProjectTitle = (title: string): boolean => {
    setValidationError("");

    const trimmedTitle = title.trim();

    // Check if empty
    if (!trimmedTitle) {
      setValidationError("Project name cannot be empty");
      return false;
    }

    // Check minimum length
    if (trimmedTitle.length < 3) {
      setValidationError("Project name must be at least 3 characters");
      return false;
    }

    // Check maximum length
    if (trimmedTitle.length > 100) {
      setValidationError("Project name must be less than 100 characters");
      return false;
    }

    // Check for valid characters only
    const validNamePattern = /^[a-zA-Z0-9\s\-_'.]+$/;
    if (!validNamePattern.test(trimmedTitle)) {
      setValidationError("Project name contains invalid characters");
      return false;
    }

    // Check for duplicate names (case-insensitive)
    const isDuplicate = projects.some(
      (p) => p.projectName.toLowerCase() === trimmedTitle.toLowerCase()
    );
    if (isDuplicate) {
      setValidationError("A project with this name already exists");
      return false;
    }

    return true;
  };

  /**
   * Handles create project button click
   * Shows upgrade modal if user has reached project limit
   * Otherwise displays the project creation form
   */
  const handleCreateClick = () => {
    if (!canCreateProject()) {
      setShowUpgradeModal(true);
      return;
    }
    setShowForm(true);
  };

  /**
   * Creates new project via API and updates UI
   * Validates title, checks limits, creates project, and navigates to project page
   * 
   * CRITICAL: Stores projectId in localStorage for session persistence
   * and adds new project to the top of the projects list
   */
  const handleCreateProject = async () => {
    const trimmedTitle = newProjectTitle.trim();

    // Validate project title
    if (!validateProjectTitle(trimmedTitle)) {
      return;
    }

    // Double-check project limit before API call
    if (!canCreateProject()) {
      setShowUpgradeModal(true);
      setShowForm(false);
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      const res = await createTocProject({
        userId,
        projectTitle: trimmedTitle,
        status: "draft", // All new projects start as draft
      });

      if (res.success && res.data) {
        // Create project object from API response
        const newProj: Project = {
          projectId: res.data.projectId,
          projectName: res.data.tocData?.projectTitle || trimmedTitle,
        };

        // Store projectId for navigation and session persistence
        localStorage.setItem("projectId", newProj.projectId);
        
        // Add new project to top of list (most recent first)
        setProjects([newProj, ...projects]);
        
        // Reset form state
        setNewProjectTitle("");
        setShowForm(false);
        setValidationError("");

        // Navigate to newly created project
        navigate(`/projects/${newProj.projectId}`);
      } else {
        setError(res.message || "Failed to create project");
      }
    } catch (err: any) {
      console.error("Create project error:", err);
      const errorMessage = err.response?.data?.message || err.message || "Failed to create project";
      setError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Handle input change and clear validation errors
   */
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewProjectTitle(value);
    if (validationError) {
      setValidationError("");
    }
  };

  /**
   * Allow Enter key to submit form
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isCreating) {
      handleCreateProject();
    }
  };

  // Computed values for UI display
  const currentPlan = getPlanName(subscription?.planId);
  const projectLimit = getProjectLimit(subscription?.planId || "free");

  return (
    <div className="projects-container">
      {/* Header with workspace title and plan info */}
      <div className="workspace-header">
        <h1>Workspace</h1>
        <div className="plan-info">
          <span className="plan-badge">{currentPlan} Plan</span>
          {/* Display project count with limit (∞ for unlimited) */}
          <span className="project-count">
            {projects.length} / {projectLimit === Infinity ? "∞" : projectLimit} projects
          </span>
        </div>
      </div>

{/* Create project button or form */}
      {!showForm ? (
        <div className="button-container">
          {/* Disable button if user has reached project limit */}
        <button 
          className="create-btn" 
          onClick={handleCreateClick}
          disabled={!canCreateProject()}
        >
          Create Project +
        </button>
        </div>
      ) : (
        /* Project creation form */
        <div className="create-form">
          <input
            value={newProjectTitle}
            onChange={handleTitleChange}
            onKeyPress={handleKeyPress}
            placeholder="Project Name"
            disabled={isCreating}
            className={validationError ? "input-error" : ""}
            autoFocus
          />
          {/* Display validation errors inline */}
          {validationError && (
            <span className="validation-error">{validationError}</span>
          )}
          <div className="form-actions">
            {/* Save button with loading state */}
            <button
              onClick={handleCreateProject}
              disabled={isCreating || !newProjectTitle.trim()}
              className={isCreating ? "creating" : ""}
            >
              {isCreating ? (
                <>
                  <span className="spinner-small"></span>
                  Creating...
                </>
              ) : (
                "Save"
              )}
            </button>
            {/* Cancel button */}
            <button
              onClick={() => {
                setShowForm(false);
                setNewProjectTitle("");
                setValidationError("");
              }}
              disabled={isCreating}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

{/* Error banner with dismiss functionality */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError("")} className="close-error">
            ×
          </button>
        </div>
      )}

      {/* Upgrade Modal - shown when user reaches project limit */}
      {showUpgradeModal && (
        <div className="modal-overlay" onClick={() => setShowUpgradeModal(false)}>
          {/* Stop propagation to prevent closing when clicking inside modal */}
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Project Limit Reached</h2>
            <p>
              You've reached the maximum of {projectLimit} projects on the {currentPlan} plan.
            </p>
            {/* Display upgrade options */}
            <div className="upgrade-options">
              <div className="plan-option">
                <h3>Pro Plan</h3>
                <p>Up to 7 projects</p>
              </div>
              <div className="plan-option premium">
                <h3>Premium Plan</h3>
                <p>Unlimited projects</p>
              </div>
            </div>
            {/* Modal action buttons */}
            <div className="modal-actions">
              <button
                className="upgrade-btn"
                onClick={() => navigate("/subscription")}
              >
                Upgrade Now
              </button>
              <button
                className="cancel-btn"
                onClick={() => setShowUpgradeModal(false)}
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}
{/* Loading state */}
      {isLoading ? (
        <div className="loading-container">
          <div className="spinner-large"></div>
          <p>Loading projects...</p>
        </div>
      ) : projects.length === 0 ? (
        /* Empty state when no projects exist */
        <div className="empty-state">
          <p>No projects yet. Create your first project to get started!</p>
        </div>
      ) : (
        /* Projects list */
        <ul className="projects-list">
          {projects.map((p) => (
            <li key={p.projectId} className="project-card">
              <h3>{p.projectName}</h3>
              {/* Open project button - stores projectId and navigates */}
              <button
                className="open-btn"
                onClick={() => {
                  localStorage.setItem("projectId", p.projectId);
                  navigate(`/projects/${p.projectId}`);
                }}
              >
                Open
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ProjectsPage;