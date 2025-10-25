import { useState, useEffect } from "react";
import { fetchTerms, updateTerms } from "../services/api";
import { useAuth } from "../auth/AuthProvider";

export default function AdminTerms() {
  const [content, setContent] = useState("");
  const { isAuthenticated } = useAuth();

  // Load terms content on mount
  useEffect(() => {
    fetchTerms().then(t => setContent(t.content ?? ""));
  }, []);

  // Save updated terms (requires admin authentication)
  const save = async () => {
    if (!isAuthenticated) {
      alert("You must be signed in as an admin to update terms.");
      return;
    }
    await updateTerms(content);
    alert("Terms updated!");
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Edit Terms and Conditions</h1>
      {/* Terms editor textarea */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full h-96 p-2 border rounded"
      />
      {/* Persist changes */}
      <button onClick={save} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">
        Save
      </button>
    </div>
  );
}
