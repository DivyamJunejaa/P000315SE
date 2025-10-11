// Updated ProjectsPage - stores subscription in localStorage
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createTocProject, fetchUserTocs, fetchSubscription } from "../services/api";
import "../style/Project.css";

type Project = { projectId: string; projectName: string };

type SubscriptionData = {
  subscriptionId: string;
  email: string;
  planId: string;
  status: string;
  startDate: string;
  renewalDate: string;
  expiresAt: string | null;
  autoRenew: boolean;
  updatedAt: string;
};

const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string>("");
  const [validationError, setValidationError] = useState<string>("");
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const navigate = useNavigate();

  const userId = localStorage.getItem("userId") || "";

  // Helper to determine plan tier
  const getPlanTier = (subscriptionData: SubscriptionData | null): 'free' | 'pro' | 'premium' => {
    if (!subscriptionData) return 'free';
    
    if (subscriptionData.status !== 'active') return 'free';
    
    if (subscriptionData.expiresAt) {
      const expiryDate = new Date(subscriptionData.expiresAt);
      if (expiryDate < new Date()) return 'free';
    }
    
    const planId = subscriptionData.planId?.toLowerCase() || '';
    if (planId.includes('premium')) return 'premium';
    if (planId.includes('pro')) return 'pro';
    return 'free';
  };

  // Project limits based on plan
  const getProjectLimit = (planId: string): number => {
    if (planId.includes("free") || !planId) return 3;
    if (planId.includes("pro")) return 7;
    if (planId.includes("premium")) return Infinity;
    return 3;
  };

  // Get current plan name
  const getPlanName = (planId?: string): string => {
    if (!planId || planId.includes("free")) return "Free";
    if (planId.includes("pro")) return "Pro";
    if (planId.includes("premium")) return "Premium";
    return "Free";
  };

  // Fetch subscription details using API service and STORE in localStorage
  const loadSubscription = async () => {
    try {
      console.log('🔄 Fetching subscription from API...');
      const result = await fetchSubscription();

      if (result.success && result.data) {
        console.log('✅ Subscription data received:', result.data);
        setSubscription(result.data);
        
        // STORE FULL SUBSCRIPTION DATA IN LOCALSTORAGE
        localStorage.setItem('subscriptionData', JSON.stringify(result.data));
        
        // STORE PLAN TIER FOR QUICK ACCESS
        const planTier = getPlanTier(result.data);
        localStorage.setItem('userPlan', planTier);
        
        // STORE PLAN ID
        localStorage.setItem('planId', result.data.planId);
        
        console.log('💾 Subscription stored in localStorage:', {
          planTier,
          planId: result.data.planId,
          status: result.data.status
        });
        
      } else {
        // No subscription found - treat as free user
        console.log('⚠️ No subscription - User is FREE');
        setSubscription(null);
        
        // STORE FREE USER STATUS
        localStorage.setItem('subscriptionData', JSON.stringify(null));
        localStorage.setItem('userPlan', 'free');
        localStorage.removeItem('planId');
      }
    } catch (err) {
      console.error("❌ Failed to fetch subscription", err);
      // On error, treat as free user
      setSubscription(null);
      localStorage.setItem('userPlan', 'free');
      localStorage.removeItem('planId');
    }
  };

  // Load user projects and subscription
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError("");
      try {
        // Fetch both projects and subscription in parallel
        await Promise.all([
          loadSubscription(),
          (async () => {
            const res = await fetchUserTocs();
            if (res.success && res.data?.projects) {
              setProjects(res.data.projects);
            } else {
              setProjects([]);
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
  }, []);

  // Check if user can create more projects
  const canCreateProject = (): boolean => {
    const planId = subscription?.planId || "free";
    const limit = getProjectLimit(planId);
    return projects.length < limit;
  };

  // Validate project title
  const validateProjectTitle = (title: string): boolean => {
    setValidationError("");

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setValidationError("Project name cannot be empty");
      return false;
    }

    if (trimmedTitle.length < 3) {
      setValidationError("Project name must be at least 3 characters");
      return false;
    }

    if (trimmedTitle.length > 100) {
      setValidationError("Project name must be less than 100 characters");
      return false;
    }

    const validNamePattern = /^[a-zA-Z0-9\s\-_'.]+$/;
    if (!validNamePattern.test(trimmedTitle)) {
      setValidationError("Project name contains invalid characters");
      return false;
    }

    const isDuplicate = projects.some(
      (p) => p.projectName.toLowerCase() === trimmedTitle.toLowerCase()
    );
    if (isDuplicate) {
      setValidationError("A project with this name already exists");
      return false;
    }

    return true;
  };

  // Handle create project button click
  const handleCreateClick = () => {
    if (!canCreateProject()) {
      setShowUpgradeModal(true);
      return;
    }
    setShowForm(true);
  };

  // Create new project
  const handleCreateProject = async () => {
    const trimmedTitle = newProjectTitle.trim();

    if (!validateProjectTitle(trimmedTitle)) {
      return;
    }

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
        status: "draft",
      });

      if (res.success && res.data) {
        const newProj: Project = {
          projectId: res.data.projectId,
          projectName: res.data.tocData?.projectTitle || trimmedTitle,
        };

        localStorage.setItem("projectId", newProj.projectId);
        setProjects([newProj, ...projects]);
        setNewProjectTitle("");
        setShowForm(false);
        setValidationError("");
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

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewProjectTitle(value);
    if (validationError) {
      setValidationError("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isCreating) {
      handleCreateProject();
    }
  };

  const currentPlan = getPlanName(subscription?.planId);
  const projectLimit = getProjectLimit(subscription?.planId || "free");

  return (
    <div className="projects-container">
      <div className="workspace-header">
        <h1>Workspace</h1>
        <div className="plan-info">
          <span className="plan-badge">{currentPlan} Plan</span>
          <span className="project-count">
            {projects.length} / {projectLimit === Infinity ? "∞" : projectLimit} projects
          </span>
        </div>
      </div>

      {!showForm ? (
        <button 
          className="create-btn" 
          onClick={handleCreateClick}
          disabled={!canCreateProject()}
        >
          Create Project +
        </button>
      ) : (
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
          {validationError && (
            <span className="validation-error">{validationError}</span>
          )}
          <div className="form-actions">
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

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError("")} className="close-error">
            ×
          </button>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="modal-overlay" onClick={() => setShowUpgradeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Project Limit Reached</h2>
            <p>
              You've reached the maximum of {projectLimit} projects on the {currentPlan} plan.
            </p>
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

      {isLoading ? (
        <div className="loading-container">
          <div className="spinner-large"></div>
          <p>Loading projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <p>No projects yet. Create your first project to get started!</p>
        </div>
      ) : (
        <ul className="projects-list">
          {projects.map((p) => (
            <li key={p.projectId} className="project-card">
              <h3>{p.projectName}</h3>
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