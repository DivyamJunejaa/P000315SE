import React, { useState, useEffect } from "react";
import ConfirmModal from "../components/ConfirmModal";
import Toast from "../components/Toast";
import { useNavigate } from "react-router-dom";
import { fetchUserProfile, updateUserProfile, cancelSubscription, updateSubscription, fetchSubscription } from "../services/api"; // Update the import path as needed
import "../style/profile.css";
// Local plan helpers 
const detectTierFromPlanId = (planId?: string | null): 'free' | 'pro' | 'premium' => {
  const id = String(planId || '').toLowerCase();
  if (!id || id.includes('free') || id === 'price_free') return 'free';
  const PRO_ID = (process.env.REACT_APP_STRIPE_PRICE_PRO || 'price_1S8tsnQTtrbKnENdYfv6azfr').toLowerCase();
  const PREMIUM_ID = (process.env.REACT_APP_STRIPE_PRICE_PREMIUM || 'price_1SB17tQTtrbKnENdT7aClaEe').toLowerCase();
  if (id === PRO_ID || id.includes('pro')) return 'pro';
  if (id === PREMIUM_ID || id.includes('premium')) return 'premium';
  return 'free';
};

const tierToDisplayName = (tier: 'free' | 'pro' | 'premium'): string => {
  if (tier === 'premium') return 'Premium Plan';
  if (tier === 'pro') return 'Pro Plan';
  return 'Free Plan';
};

type UserProfile = {
  userId: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  organisation: string;
  avatarUrl?: string | null;
  displayName: string;
  createdAt: string;
};

type Subscription = {
  plan: string;
  status: string;
  expiry: string;
  price?: string;
  activatedAt?: string;
  sessionId?: string;
  subscriptionId?: string;
  cancellationScheduledUntil?: string;
};

type ProfilePageProps = {
  subscription?: Subscription;
};

const ProfilePage: React.FC<ProfilePageProps> = ({ subscription }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userSubscription, setUserSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    organisation: "",
    username: ""
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  // Load profile and subscription data on mount
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const profileData = await fetchUserProfile();
        setUserProfile(profileData);
        // Initialize form with current data
        setEditForm({
          firstName: profileData.firstName || "",
          lastName: profileData.lastName || "",
          organisation: profileData.organisation || "",
          username: profileData.username || ""
        });
      } catch (err: any) {
        setError(err.message || "Failed to load user profile");
        console.error("Error fetching user profile:", err);
      } finally {
        setLoading(false);
      }
    };

    const loadSubscriptionData = () => {
      try {
        // Prefer unified subscriptionData stored by Project/Success flows
        const storedUnified = localStorage.getItem("subscriptionData");
        if (storedUnified) {
          const unified = JSON.parse(storedUnified);
          if (unified) {
            const tier = detectTierFromPlanId(unified.planId);
            const displayPlan = tierToDisplayName(tier);
            const expiryStr = unified.expiresAt ? new Date(unified.expiresAt).toLocaleDateString() : "";
            const mapped: Subscription = {
              plan: displayPlan,
              status: unified.status || "active",
              expiry: expiryStr,
              price: undefined,
              activatedAt: unified.startDate,
              sessionId: undefined,
              subscriptionId: unified.subscriptionId,
              cancellationScheduledUntil: undefined,
            };
            setUserSubscription(mapped);
            return;
          }
        }

        // // Legacy fallback: userSubscription used by older flows/tests
        // const legacyRaw = localStorage.getItem("userSubscription");
        // if (legacyRaw) {
        //   const legacy = JSON.parse(legacyRaw);
        //   setUserSubscription({
        //     plan: legacy?.plan || "Free Plan",
        //     status: legacy?.status || "active",
        //     expiry: legacy?.expiry || "",
        //     price: legacy?.price,
        //     activatedAt: legacy?.activatedAt,
        //     sessionId: legacy?.sessionId,
        //     subscriptionId: legacy?.subscriptionId,
        //     cancellationScheduledUntil: legacy?.cancellationScheduledUntil,
        //   });
        //   return;
        // }

        // // Default free plan when nothing is stored
        // setUserSubscription({
        //   plan: "Free Plan",
        //   status: "active",
        //   expiry: ""
        // });
      } catch (error) {
        console.error("Error loading subscription data:", error);
        setUserSubscription({
          plan: "Free Plan",
          status: "active",
          expiry: ""
        });
      }
    };

    loadUserProfile();
    loadSubscriptionData();
  }, []);

  // Toggle edit mode and reset form when canceling
  const handleEditToggle = () => {
    if (isEditing) {
      // Reset form to original values when canceling
      setEditForm({
        firstName: userProfile?.firstName || "",
        lastName: userProfile?.lastName || "",
        organisation: userProfile?.organisation || "",
        username: userProfile?.username || ""
      });
    }
    setIsEditing(!isEditing);
    setError(null);
    setSuccessMessage(null);
  };

  // Handle local form field changes
  const handleFormChange = (field: string, value: string) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Persist profile updates to backend
  const handleSaveChanges = async () => {
    try {
      setUpdateLoading(true);
      setError(null);
      setSuccessMessage(null);
      
      const updatedData = await updateUserProfile({
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        organisation: editForm.organisation,
        username: editForm.username
      });
      
      setUserProfile(updatedData);
      setIsEditing(false);
      setSuccessMessage("Profile updated successfully!");
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setUpdateLoading(false);
    }
  };

  async function handleUpgrade() {
    // Redirect to local plans page instead of hitting checkout API
    if (!userProfile?.userId) {
      setCheckoutError("You need to be logged in to upgrade.");
      return;
    }
    setCheckoutError(null);
    navigate("/plans");
  }

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" | "info" } | null>(null);

  async function handleManageSubscription() {
    setShowCancelModal(true);
  }

  async function confirmCancelSubscription() {
    try {
      setCheckoutLoading(true);
      setCheckoutError(null);

      const userId = userProfile?.userId;
      if (!userId) {
        setCheckoutError("Unable to cancel subscription: User not found");
        setToast({ message: "Unable to cancel: user not found", type: "error" });
        return;
      }

      const subscriptionId = (() => {
        const subId = userSubscription?.subscriptionId;
        if (subId && (subId.startsWith('sub_') || subId.startsWith('cs_'))) return subId;
        const csId = (userSubscription as any)?.sessionId;
        if (csId && typeof csId === 'string' && csId.startsWith('cs_')) return csId;
        return undefined;
      })();

      const result = await cancelSubscription({
        user_id: userId,
        subscription_id: subscriptionId,
      });

      if (result.success) {
        try {
          const email = userProfile?.email || "";
          const now = new Date();
          const payload = {
            subscriptionId: subscriptionId || `${userId}-${now.getTime()}`,
            email,
            planId: (userSubscription?.plan || "free").toLowerCase(),
            status: "canceled",
            startDate: userSubscription?.activatedAt || now.toISOString(),
            renewalDate: now.toISOString(),
            expiresAt: now.toISOString(),
            autoRenew: false,
          };
          await updateSubscription(payload);
        } catch (e) {
          console.warn("Failed to sync cancellation:", e);
        }
        // Refresh subscription details from backend and update local state
        try {
          const resp = await fetchSubscription();
          const data = resp?.data || null;
          if (data) {
            const tier = detectTierFromPlanId(data.planId);
            const displayPlan = tierToDisplayName(tier);
            const periodEnd = data.expiresAt ? new Date(data.expiresAt).toLocaleDateString() : (userSubscription?.expiry || "");
            const updated = {
              plan: displayPlan,
              status: (data.status || 'active'),
              expiry: periodEnd,
              price: userSubscription?.price,
              activatedAt: data.startDate || userSubscription?.activatedAt,
              sessionId: userSubscription?.sessionId,
              subscriptionId: data.subscriptionId || userSubscription?.subscriptionId,
              cancellationScheduledUntil: periodEnd,
            };
            setUserSubscription(updated);
            try { localStorage.setItem("userSubscription", JSON.stringify(updated)); } catch {}
          } else {
            const updated = {
              plan: userSubscription?.plan || "Pro Plan",
              status: "active",
              expiry: userSubscription?.expiry || "",
              price: userSubscription?.price,
              activatedAt: userSubscription?.activatedAt,
              cancellationScheduledUntil: userSubscription?.expiry || "",
            };
            setUserSubscription(updated);
            try { localStorage.setItem("userSubscription", JSON.stringify(updated)); } catch {}
          }
        } catch {
          const updated = {
            plan: userSubscription?.plan || "Pro Plan",
            status: "active",
            expiry: userSubscription?.expiry || "",
            price: userSubscription?.price,
            activatedAt: userSubscription?.activatedAt,
            cancellationScheduledUntil: userSubscription?.expiry || "",
          };
          setUserSubscription(updated);
          try { localStorage.setItem("userSubscription", JSON.stringify(updated)); } catch {}
        }

        // Immediately move user to Free plan locally
        const now = new Date();
        const updated = {
          plan: "Free Plan",
          status: "canceled",
          expiry: now.toLocaleDateString(),
          price: undefined,
          activatedAt: userSubscription?.activatedAt,
          sessionId: undefined,
          subscriptionId: undefined,
          cancellationScheduledUntil: undefined,
        };
        setUserSubscription(updated);
        try { localStorage.setItem("userSubscription", JSON.stringify(updated)); } catch {}
        setToast({ message: "Subscription canceled. You have been moved to Free plan.", type: "success" });
        try { window.alert("Subscription canceled successfully"); } catch {}
      } else {
        setCheckoutError("Failed to cancel subscription. Please try again.");
        setToast({ message: "Failed to cancel subscription. Please try again.", type: "error" });
      }
    } catch (error: any) {
      setCheckoutError(error.message || "Failed to cancel subscription");
      setToast({ message: error.message || "Failed to cancel subscription", type: "error" });
    } finally {
      setCheckoutLoading(false);
      setShowCancelModal(false);
    }
  }

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-container">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h3>Oops! Something went wrong</h3>
          <p>{error}</p>
          <button 
            className="retry-button"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
      {/* Left panel: user details */}
      <div className="profile-left">
        <div className="avatar">
          {userProfile?.avatarUrl ? (
            <img src={userProfile.avatarUrl} alt="Profile Avatar" />
          ) : (
            <div className="avatar-placeholder">
              {userProfile?.firstName?.[0]?.toUpperCase() || "U"}
            </div>
          )}
        </div>
        
        {/* Success Message */}
        {successMessage && (
          <div className="success-message">
             {successMessage}
          </div>
        )}
        
        {/* Error Message */}
        {error && !isEditing && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}
        
        {!isEditing ? (
          // View Mode
          <>
            <h2 className="display-name">
              {userProfile?.displayName || "Guest User"}
            </h2>
            <p className="username">@{userProfile?.username || "username"}</p>
            <p className="email">{userProfile?.email || "Email not available"}</p>
            
            {userProfile?.organisation && (
              <p className="organization">🏢 {userProfile.organisation}</p>
            )}
            
            {userProfile?.createdAt && (
              <p className="member-since">
                📅 Member since {new Date(userProfile.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            )}
            
            <div className="profile-actions">
              <button className="btn-edit" onClick={handleEditToggle}>
                 Edit Profile
              </button>
            </div>
          </>
        ) : (
          // Edit Mode
          <>
            <h2 className="display-name">Edit Profile</h2>
            
            <div className="edit-form">
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.firstName}
                  onChange={(e) => handleFormChange('firstName', e.target.value)}
                  placeholder="Enter first name"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.lastName}
                  onChange={(e) => handleFormChange('lastName', e.target.value)}
                  placeholder="Enter last name"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.username}
                  onChange={(e) => handleFormChange('username', e.target.value)}
                  placeholder="Enter username"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Organisation</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.organisation}
                  onChange={(e) => handleFormChange('organisation', e.target.value)}
                  placeholder="Enter organisation"
                />
              </div>
              
              {error && (
                <div className="error-message">
                  ⚠️ {error}
                </div>
              )}
              
              <div className="form-actions">
                <button 
                  className="btn-save-profile"
                  onClick={handleSaveChanges}
                  disabled={updateLoading}
                >
                  {updateLoading ? "Saving..." : "Save Changes"}
                </button>
                <button 
                  className="btn-cancel"
                  onClick={handleEditToggle}
                  disabled={updateLoading}
                >
                   Cancel
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right panel: subscription details */}
      <div className="profile-right">
        <h3 className="section-title">
          💎 Subscription Details
        </h3>
        <div className="subscription-card">
          <div className="subscription-header">
            <div className="plan-info">
              <h4 className="plan-name">{userSubscription?.plan || "Free Plan"}</h4>
              <span className={`status-badge status-${userSubscription?.status?.toLowerCase() || 'inactive'}`}>
                {userSubscription?.status || "Inactive"}
              </span>
            </div>
          </div>
          
          {(() => {
            const isCancellationScheduled = Boolean(userSubscription?.cancellationScheduledUntil);
            const isCancelled = String(userSubscription?.status || '').toLowerCase() === 'canceled' || isCancellationScheduled;
            return (userSubscription?.expiry && !isCancelled) ? (
              <div className="expiry-info">
                <p><strong>Valid until:</strong> {userSubscription.expiry}</p>
              </div>
            ) : null;
          })()}
          
          {userSubscription?.price && (
            <div className="price-info">
              <p><strong>Price:</strong> {userSubscription.price}</p>
            </div>
          )}
          
          {userSubscription?.activatedAt && (
            <div className="activated-info">
              <p>
                <strong>Activated:</strong> {new Date(userSubscription.activatedAt).toLocaleDateString()}
                {userSubscription?.cancellationScheduledUntil && (
                  <span style={{ marginLeft: 8, color: "#e67e22", fontWeight: 500 }}>
                    Cancellation scheduled — valid until {userSubscription.cancellationScheduledUntil}
                  </span>
                )}
              </p>
            </div>
          )}
          
          <div className="subscription-actions">
            <button className="btn-primary" onClick={handleUpgrade} disabled={checkoutLoading}>
              {checkoutLoading ? "Starting checkout..." : (userSubscription?.plan === "Free Plan" ? "Upgrade Plan" : "Change Plan")}
            </button>
            {userSubscription?.plan !== "Free Plan" &&
             // Show Cancel button only if cancellation is NOT already scheduled and status remains active
             !userSubscription?.cancellationScheduledUntil &&
             ((userSubscription?.status || 'active').toLowerCase() === 'active') && (
              <button 
                className="btn-secondary" 
                onClick={handleManageSubscription}
                disabled={checkoutLoading}
              >
                {checkoutLoading ? "Canceling..." : "Cancel"}
              </button>
            )}
          </div>
          {checkoutError && (
            <div className="error-message" style={{ marginTop: 8 }}>
              ⚠️ {checkoutError}
            </div>
          )}
        </div>
        
        {/* Additional Info Section */}
        <div className="additional-info">
          <h3 className="section-title">📊 Account Overview</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-icon">✉️</span>
              <div className="info-content">
                <span className="info-label">Email</span>
                <span className="info-value">{userProfile?.email || "N/A"}</span>
              </div>
            </div>
            
            <div className="info-item">
              <span className="info-icon">👤</span>
              <div className="info-content">
                <span className="info-label">Username</span>
                <span className="info-value">{userProfile?.username || "N/A"}</span>
              </div>
            </div>
            
            {userProfile?.organisation && (
              <div className="info-item">
                <span className="info-icon">🏢</span>
                <div className="info-content">
                  <span className="info-label">Organisation</span>
                  <span className="info-value">{userProfile.organisation}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {showCancelModal && (
        <ConfirmModal
          title="Cancel Subscription"
          message="Cancel your subscription immediately? Your account will switch to Free plan now."
          confirmText="Yes, cancel"
          cancelText="Keep subscription"
          onConfirm={confirmCancelSubscription}
          onCancel={() => setShowCancelModal(false)}
        />
      )}
    </div>
  );
};

export default ProfilePage;