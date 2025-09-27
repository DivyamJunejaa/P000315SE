import axios from "axios";
import { createUser, verifyLogin, signToken } from "../mocks/service.memory";

// const API_BASE = "https://nodejs-serverless-function-express-rho-ashen.vercel.app";
const API_BASE = "https://toc-user-backend.vercel.app";

// Authentication APIs
export const authRegister = async (payload: {
  email: string; password: string; firstName?: string; lastName?: string; org?: string;
}) => {
  const user = await createUser(payload);
  const token = `dev-${user.id}-${Date.now()}`;   // fake token for dev
  return { token, user };
};

export const authLogin = async (payload: { email: string; password: string }) => {
  const user = await verifyLogin(payload.email, payload.password);
  const token = `dev-${user.id}-${Date.now()}`;   // fake token
  return { token, user };
};

export const forgotPassword = async (data: {
  email: string;
}) => {
  const response = await axios.post(`${API_BASE}/api/auth/password.Reset`, {
    email: data.email,
    action: "request-reset"
  });
  return response.data;
};

export const resetPassword = async (data: {
  email: string;
  token: string;
  newPassword: string;
}) => {
  const response = await axios.post(`${API_BASE}/api/auth/password.Reset`, {
    email: data.email,
    action: "verify-token",
    token: data.token,
    newPassword: data.newPassword
  });
  return response.data;
};



// TOC Project APIs

export const createTocProject = async (data: {
  userId: string;
  projectTitle: string;
  status: "draft" | "published";
}) => {
  const response = await axios.post(`${API_BASE}/api/project/toc.Create`, data);
  return response.data;
};

export const updateToc = async (data: {
  userId: string;
  projectId: string;
  projectTitle: string;
  updateName: boolean;
  status: "draft" | "published";
  tocData: {
    bigPictureGoal: string;
    projectAim: string;
    objectives: string[];
    beneficiaries: {
      description: string;
      estimatedReach: number;
    };
    activities: string[];
    outcomes: string[];
    externalFactors: string[];
    evidenceLinks: string[];
  };
}) => {
  const response = await axios.put(`${API_BASE}/api/project/toc.Update`, data);
  return response.data;
};

/**
 * Fetch TOC project by userId and projectId
 */
export const fetchTocProjectById = async (userId: string, projectId: string) => {
  try {
    const response = await axios.get(
      `${API_BASE}/api/project/toc.Get?userId=${userId}&projectId=${projectId}`
    );
    return response.data; // { success, message, data }
  } catch (error: any) {
    console.error("Error fetching TOC project by ID", error.response?.data || error.message);
    throw error;
  }
};
/**
 * Fetch all projects for a user
 */
export const fetchUserProjects = async (userId: string) => {
  try {
    const response = await axios.get(`${API_BASE}/api/project/user/${userId}`);
    return response.data;
  } catch (error: any) {
    console.error("Error fetching user projects:", error.response?.data || error.message);
    throw error;
  }
};

export const fetchUserTocs = async (userId: string) => {
  try {
    const response = await axios.get(
      `${API_BASE}/api/project/toc.GetProjectList`,
      {
        params: { userId },
        headers: { "Content-Type": "application/json" },
      }
    );
    return response.data; // { success, message, data: { projects, count }, status }
  } catch (error: any) {
    console.error(
      "Error fetching user TOCs:",
      error.response?.data || error.message
    );
    throw error;
  }
};
