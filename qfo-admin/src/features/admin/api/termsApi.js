import api from "../../../services/api";

/**
 * Fetch terms and conditions content
 * @returns {Promise<Object>} Terms data with content and metadata
 */
export const fetchTerms = async () => {
  try {
    const response = await api.get("/api/admin/terms");
    return {
      content: response.data.content || "",
      updatedAt: response.data.updatedAt || new Date().toISOString(),
      version: response.data.version || 1
    };
  } catch (error) {
    console.error("Error fetching terms:", error);
    throw new Error("Failed to fetch terms and conditions");
  }
};

/**
 * Update terms and conditions content
 * @param {string} content - The new terms content
 * @returns {Promise<Object>} Updated terms data
 */
export const updateTerms = async (content) => {
  try {
    const response = await api.post("/api/admin/terms", { 
      content,
      updatedAt: new Date().toISOString()
    });
    return {
      content: response.data.content,
      updatedAt: response.data.updatedAt || new Date().toISOString(),
      version: response.data.version || 1
    };
  } catch (error) {
    console.error("Error updating terms:", error);
    throw new Error("Failed to update terms and conditions");
  }
};

/**
 * Get terms history/versions (if supported by backend)
 * @returns {Promise<Array>} Array of terms versions
 */
export const getTermsHistory = async () => {
  try {
    const response = await api.get("/api/terms/history");
    return response.data.history || [];
  } catch (error) {
    console.error("Error fetching terms history:", error);
    // Return empty array if history is not supported
    return [];
  }
};

/**
 * Validate terms content
 * @param {string} content - Content to validate
 * @returns {Object} Validation result
 */
export const validateTermsContent = (content) => {
  const errors = [];
  const warnings = [];

  // Basic validation
  if (!content || content.trim().length === 0) {
    errors.push("Terms content cannot be empty");
  }

  if (content && content.length < 100) {
    warnings.push("Terms content seems quite short. Consider adding more detail.");
  }

  if (content && content.length > 50000) {
    warnings.push("Terms content is very long. Consider breaking it into sections.");
  }

  // Check for common legal terms
  const commonTerms = [
    "terms and conditions",
    "privacy",
    "liability",
    "agreement",
    "service"
  ];

  const hasCommonTerms = commonTerms.some(term => 
    content.toLowerCase().includes(term.toLowerCase())
  );

  if (!hasCommonTerms) {
    warnings.push("Consider including common legal terminology for clarity.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    wordCount: content ? content.split(/\s+/).length : 0,
    characterCount: content ? content.length : 0
  };
};