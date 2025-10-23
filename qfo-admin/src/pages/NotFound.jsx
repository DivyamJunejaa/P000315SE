/*
  NotFound: basic 404 page for unknown admin routes.
  - Displays a simple message and status code
  - Style keeps it consistent with admin UI color palette
*/
export default function NotFound() {
    // Render minimal 404 message for unmatched routes
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>404</h1>
        <p>Page not found.</p>
      </div>
    );
  }
  