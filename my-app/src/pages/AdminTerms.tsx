/*
  AdminTerms: simple admin editor for Terms and Conditions.
  - Loads current terms on mount
  - Requires authenticated admin for updates
  - Saves changes via API and shows feedback
*/
import { useState, useEffect } from "react";
import { fetchTerms, updateTerms } from "../services/api";
import { useAuth } from "../auth/AuthProvider";

export default function AdminTerms() {
  const [content, setContent] = useState("");
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    fetchTerms().then(t => setContent(t.content ?? ""));
  }, []);

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
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full h-96 p-2 border rounded"
      />
      <button onClick={save} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">
        Save
      </button>
    </div>
  );
}
