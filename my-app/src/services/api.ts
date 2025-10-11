import axios from "axios";
import { verifyLogin, signToken } from "../mocks/service.memory";

// Base URL for user auth and project APIs
const API_BASE = process.env.REACT_APP_API_BASE || "https://nodejs-serverless-function-express-rho-ashen.vercel.app";
const PASS_API_BASE = process.env.REACT_APP_API_BASE || "https://nodejs-serverless-function-express-rho-ashen.vercel.app";
// Separate base for payment/checkout endpoints (serverless backend)
const PAYMENT_API_BASE = process.env.REACT_APP_PAYMENT_API_BASE || "https://admin-backend-two-flame.vercel.app";

const isNetworkError = (err: any) => !err?.response || err?.message === "Network Error";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Authentication APIs
export const authRegister = async (payload: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organisation: string;     // map to organization if backend expects that spelling
  username: string;
  acceptTandC: boolean;
  newsLetterSubs: boolean;
}) => {
  try {
    // Step 1: Create user account
    const res = await axios.post(
      `${API_BASE}/api/user/Create`,
      {
        email: payload.email,
        password: payload.password,
        firstName: payload.firstName,
        lastName: payload.lastName,
        organization: payload.organisation,   // <-- if backend uses "organisation" keep same
        username: payload.username,
        acceptTandC: payload.acceptTandC,
        newsLetterSubs: payload.newsLetterSubs,
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const { success, message } = res.data ?? {};
    if (!success) throw new Error(message || "Registration failed");

    // Step 2: Immediately login to get token
    const loginRes = await axios.post(
      `${API_BASE}/api/auth/Login`,
      { email: payload.email, password: payload.password },
      { headers: { "Content-Type": "application/json" } }
    );

    const { success: loginOk, data, message: loginMsg } = loginRes.data ?? {};
    if (!loginOk) throw new Error(loginMsg || "Auto-login failed after registration");

    return { token: data.token, user: data.user };
  } catch (err: any) {
    throw new Error(err.response?.data?.message || err.message || "Registration failed");
  }
};

export const authLogin = async (payload: { email: string; password: string }) => {
  try {
    const response = await axios.post(
      `${API_BASE}/api/auth/Login`,
      payload,
      { headers: { "Content-Type": "application/json" } }
    );

    const { success, data, message } = response.data;

    if (!success) throw new Error(message || "Login failed");

    return { token: data.token, user: data.user };
  } catch (err: any) {
    // Fallback for local development when backend is unreachable
    if (isNetworkError(err)) {
      try {
        const devUser = await verifyLogin(payload.email, payload.password);
        const token = signToken(devUser);
        const user = { ...devUser, userId: Number(Date.now() % 100000) };
        return { token, user };
      } catch (e: any) {
        throw new Error(e?.message || "Login failed (backend unreachable)");
      }
    }
    throw new Error(err.response?.data?.message || err.message || "Login failed");
  }
};

export const forgotPassword = async (data: { email: string }) => {
  // Unified endpoint for requesting a password reset code
  const response = await axios.post(`${PASS_API_BASE}/api/auth/password.Reset`, {
    email: data.email,
    action: "request-reset",
  });
  return response.data;
};

export const resetPassword = async (data: {
  email: string;
  token: string;
  newPassword: string;
}) => {
  // Unified endpoint for verifying token and resetting password
  const response = await axios.post(`${PASS_API_BASE}/api/auth/password.Reset`, {
    email: data.email,
    action: "verify-token",
    token: data.token,
    newPassword: data.newPassword,
  });
  return response.data;
};

// Google login using Firebase ID token
export const authGoogleLogin = async (idToken: string) => {
  try {
    const res = await axios.post(
      `${API_BASE}/api/auth/Google`,
      { idToken },
      { headers: { "Content-Type": "application/json" } }
    );

    const { success, data, message } = res.data ?? {};
    if (success === false) throw new Error(message || "Google login failed");

    const pack = data ?? res.data; // supports {success,data:{user,token}} or {user,token}
    if (!pack?.token || !pack?.user) throw new Error("Invalid Google login response");

    return { token: pack.token, user: pack.user };
  } catch (err: any) {
    throw new Error(err?.response?.data?.message || err.message || "Google login failed");
  }
};

// User Profile API
export const fetchUserProfile = async () => {
  try {
    const response = await axios.get(`${API_BASE}/api/user/Get`, {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
    });

    const { success, data, message } = response.data;

    if (!success) throw new Error(message || "Failed to fetch user profile");

    return data; // Returns the user profile data
  } catch (err: any) {
    if (isNetworkError(err)) {
      // Graceful fallback: use localStorage user
      try {
        const raw = localStorage.getItem("user");
        if (!raw) throw new Error("No local user available");
        const u = JSON.parse(raw);
        return {
          userId: Number(u?.userId || 0),
          email: u?.email || "demo@example.com",
          username: u?.username || "demo",
          firstName: u?.firstName || "Demo",
          lastName: u?.lastName || "User",
          organisation: u?.org || u?.organisation || "",
          avatarUrl: null,
          displayName: `${u?.firstName || "Demo"} ${u?.lastName || "User"}`,
          createdAt: new Date().toISOString(),
        };
      } catch (e: any) {
        throw new Error(e?.message || "Failed to load user profile (backend unreachable)");
      }
    }
    throw new Error(err.response?.data?.message || err.message || "Failed to fetch user profile");
  }
};

export const updateUserProfile = async (payload: {
  firstName?: string;
  lastName?: string;
  organisation?: string;
  username?: string;
}) => {
  try {
    const response = await axios.put(`${API_BASE}/api/user/Update`, payload, {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
    });

    const { success, data, message } = response.data;

    if (!success) throw new Error(message || "Failed to update user profile");

    return data; // Returns the updated user profile data
  } catch (err: any) {
    throw new Error(err.response?.data?.message || err.message || "Failed to update user profile");
  }
};
// TOC Project APIs

export const createTocProject = async (data: {
  userId: string;
  projectTitle: string;
  status: "draft" | "published";
}) => {
  try {
    const response = await axios.post(
      `${API_BASE}/api/project/Create`,
      data,
      {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      }
    );
    return response.data; // { success, message, data, statusCode }
  } catch (err: any) {
    if (isNetworkError(err)) {
      const projectId = `local-${Date.now()}`;
      return {
        success: true,
        message: "Created locally (offline mode)",
        statusCode: 200,
        data: {
          projectId,
          tocData: { projectTitle: data.projectTitle },
          tocColor: {},
        },
      };
    }
    throw new Error(err.response?.data?.message || err.message || "Failed to create project");
  }
};

export const updateToc = async (payload: any) => {
  const token = localStorage.getItem("token"); // get the stored token
  if (!token) throw new Error("No authentication token found");

  try {
    const response = await axios.put(
      `${API_BASE}/api/project/Update`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data; // { success, message, data, statusCode }
  } catch (err: any) {
    if (isNetworkError(err)) {
      return { success: true, message: "Saved locally (offline mode)", data: {}, statusCode: 200 };
    }
    throw new Error(err.response?.data?.message || err.message || "Failed to update project");
  }
};


export const fetchUserTocs = async () => {
  try {
    const response = await axios.get(`${API_BASE}/api/project/GetProjectList`, {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(), // token identifies the user
      },
    });
    return response.data; // { success, data, message }
  } catch (err: any) {
    if (isNetworkError(err)) {
      return { success: true, data: { projects: [] }, message: "Loaded empty list (offline mode)" };
    }
    throw new Error(err.response?.data?.message || err.message || "Failed to fetch projects");
  }
};


export const fetchTocProjectById = async (projectId: string) => {
  if (!projectId) throw new Error("Project ID is required");

  try {
    const response = await axios.get(`${API_BASE}/api/project/Get`, {
      params: { projectId },
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
    });

    // response.data should contain your saved tocData and tocColor
    return response.data;
  } catch (err: any) {
    if (isNetworkError(err)) {
      return { success: true, data: { projects: [] }, message: "No project loaded (offline mode)" };
    }
    throw new Error(err.response?.data?.message || err.message || "Failed to fetch project");
  }
};

// ---- Subscription / Payment APIs ----
export const createCheckoutSession = async (data: {
  price_id: string;
  user_id: string | number;
  success_url?: string;
  cancel_url?: string;
}) => {
  try {
    const response = await axios.post(
      `${PAYMENT_API_BASE}/api/payment/create-checkout-session`,
      {
        price_id: data.price_id,
        user_id: data.user_id,
        success_url: data.success_url,
        cancel_url: data.cancel_url,
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const { success, url, message } = response.data || {};
    if (!success || !url) {
      throw new Error(message || "Failed to create checkout session");
    }
    return { success, url } as { success: boolean; url: string };
  } catch (err: any) {
    throw new Error(err.response?.data?.message || err.message || "Failed to create checkout session");
  }
};

export const cancelSubscription = async (data: {
  user_id: string | number;
  subscription_id?: string;
}) => {
  try {
    const response = await axios.post(
      `${PAYMENT_API_BASE}/api/payment/cancel-subscription`,
      {
        user_id: data.user_id,
        subscription_id: data.subscription_id,
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const { success, message } = response.data || {};
    if (!success) {
      throw new Error(message || "Failed to cancel subscription");
    }
    return { success, message };
  } catch (err: any) {
    // If the backend endpoint doesn't exist yet, we'll handle it gracefully
    if (err.response?.status === 404 || isNetworkError(err)) {
      // For now, we'll simulate cancellation by clearing local storage
      localStorage.removeItem("userSubscription");
      return { 
        success: true, 
        message: "Subscription canceled successfully (local simulation)" 
      };
    }
    throw new Error(err.response?.data?.message || err.message || "Failed to cancel subscription");
  }
};

export const getStripeSubscription = async (params: { subscription_id?: string; session_id?: string }) => {
  try {
    const url = `${PAYMENT_API_BASE}/api/payment/get-subscription`;
    const response = await axios.get(url, {
      params,
      headers: { "Content-Type": "application/json" },
    });

    const { success, data, message } = response.data || {};
    if (!success) throw new Error(message || 'Failed to fetch Stripe subscription');
    return data;
  } catch (err: any) {
    console.error('Get Stripe subscription error', {
      status: err?.response?.status,
      response: err?.response?.data,
    });
    throw new Error(err.response?.data?.message || err.message || 'Failed to fetch Stripe subscription');
  }
};
export const updateSubscription = async (data: {
  subscriptionId: string;
  email: string;
  planId: string;
  status: string;
  startDate: string;
  renewalDate: string;
  expiresAt: string;
  autoRenew: boolean;
}) => {
  try {
    // Backend expects EXACT camelCase keys as below
    const payload = {
      subscriptionId: data.subscriptionId,
      email: data.email,
      planId: data.planId,
      status: data.status,
      startDate: data.startDate,
      renewalDate: data.renewalDate,
      expiresAt: data.expiresAt,
      autoRenew: data.autoRenew,
    };

    const url = `${API_BASE}/api/subscription/Create`;
    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
    });

    const { success, message } = response.data || {};
    if (!success) {
      throw new Error(message || "Failed to update subscription");
    }
    return { success, message };
  } catch (err: any) {
    // Enhanced logging for easier debugging
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.error(
      "Subscription update error",
      {
        status,
        message: err?.message,
        response: data,
      }
    );
    throw new Error(err.response?.data?.message || err.message || "Failed to update subscription");
  }
};

export const getSubscriptionPlans = async () => {
  // Temporary: return hardcoded plans until backend endpoint is available
  return [
    {
      id: "free",
      name: "Free",
      stripe_price_id_monthly: "price_free",
      features: ["Basic access"],
    },
    {
      id: "starter",
      name: "Starter",
      stripe_price_id_monthly: "price_1S8tsnQTtrbKnENdYfv6azfr",
      features: ["Form & Visual editor", "Export diagram"],
    },
    {
      id: "pro",
      name: "Pro",
      stripe_price_id_monthly: "price_1SB17tQTtrbKnENdT7aClaEe",
      features: ["Everything in Starter", "Advanced customization"],
    },
  ];
};

// ---- Terms & Conditions APIs ----
export const fetchTerms = async () => {
  try {
    const response = await axios.get(
      `${API_BASE}/api/terms`,
      { headers: getAuthHeaders() }
    );

    const { success, data, message } = response.data || {};
    if (!success) {
      throw new Error(message || "Failed to fetch terms");
    }
    return data;
  } catch (err: any) {
    // Fallback for when backend endpoint doesn't exist yet
    if (err.response?.status === 404 || isNetworkError(err)) {
      return {
        content: `# Terms and Conditions

## 1. Acceptance of Terms
By accessing and using this Theory of Change Visualization tool, you accept and agree to be bound by the terms and provision of this agreement.

## 2. Use License
Permission is granted to temporarily download one copy of the materials on this website for personal, non-commercial transitory viewing only.

## 3. Disclaimer
The materials on this website are provided on an 'as is' basis. We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties including without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.

## 4. Limitations
In no event shall Quality for Outcomes or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on this website.

## 5. Privacy Policy
Your privacy is important to us. We collect and use your information in accordance with our Privacy Policy.

## 6. User Accounts
You are responsible for maintaining the confidentiality of your account and password and for restricting access to your computer.

## 7. Modifications
Quality for Outcomes may revise these terms of service at any time without notice. By using this website, you are agreeing to be bound by the then current version of these terms of service.

## 8. Contact Information
If you have any questions about these Terms and Conditions, please contact us at support@qualityforoutcomes.com.

Last updated: ${new Date().toLocaleDateString()}`,
        lastUpdated: new Date().toISOString()
      };
    }
    throw new Error(err.response?.data?.message || err.message || "Failed to fetch terms");
  }
};

export const updateTerms = async (content: string) => {
  try {
    const response = await axios.put(
      `${API_BASE}/api/terms`,
      { content },
      { headers: { ...getAuthHeaders(), "Content-Type": "application/json" } }
    );

    const { success, message } = response.data || {};
    if (!success) {
      throw new Error(message || "Failed to update terms");
    }
    return { success, message: message || "Terms updated successfully" };
  } catch (err: any) {
    // Fallback for when backend endpoint doesn't exist yet
    if (err.response?.status === 404 || isNetworkError(err)) {
      // For now, we'll simulate success since this is likely an admin-only feature
      return { 
        success: true, 
        message: "Terms updated successfully (local simulation)" 
      };
    }
    throw new Error(err.response?.data?.message || err.message || "Failed to update terms");
  }
};

/**
 * Fetch user's subscription details
 * @returns Subscription data including plan, status, and renewal info
 */
export const fetchSubscription = async () => {
  try {
    const response = await axios.get(`${API_BASE}/api/subscription/Get`, {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
    });

    const { success, data, message } = response.data;

    if (!success) {
      // User might not have a subscription yet (free user)
      if (response.data.statusCode === 404) {
        return {
          success: true,
          data: null, // No subscription = free user
          message: "No active subscription",
        };
      }
      throw new Error(message || "Failed to fetch subscription");
    }

    return { success: true, data };
  } catch (err: any) {
    // Handle network errors or when backend is unreachable
    if (isNetworkError(err)) {
      return {
        success: true,
        data: null, // Treat as free user when offline
        message: "No subscription data available (offline mode)",
      };
    }

    // Handle 404 - user has no subscription
    if (err.response?.status === 404) {
      return {
        success: true,
        data: null,
        message: "No active subscription",
      };
    }

    throw new Error(
      err.response?.data?.message || 
      err.message || 
      "Failed to fetch subscription"
    );
  }
};
