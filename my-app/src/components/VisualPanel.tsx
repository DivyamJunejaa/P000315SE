import React, { useState, useEffect, useRef } from "react";
import { Data } from "../pages/App";
import { exportVisualDiagram } from "../utils/exportUtils";
import "../style/Visual.css";
import { useNavigate } from "react-router-dom";

type VisualProps = {
  data: Data;
  updateField: (field: keyof Data, value: string) => void;
  columnColors?: { [field in keyof Data]?: { bg: string; text: string } };
  cloudColors?: { bg: string; text: string }[];
  updateColumnColors?: (colors: { [field in keyof Data]?: { bg: string; text: string } }) => void;
  updateCloudColors?: (colors: { bg: string; text: string }[]) => void;
  onFieldAdded?: (fieldName: string) => void;
  isLoading?: boolean;
};

type CardConfig = {
  value: string;
};

type ColumnConfig = {
  title: string;
  field: keyof Data;
  cards: CardConfig[];
};



// Loading Spinner Component
const LoadingSpinner = () => {
  return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p className="loading-text">Loading project data...</p>
    </div>
  );
};

// Toast Notification Component
const Toast = ({ message, type = "success", onClose }: { message: string; type?: "success" | "error" | "warning"; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2" fill="none"/>
        <path d="M6 10L9 13L14 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    error: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2" fill="none"/>
        <path d="M7 7L13 13M13 7L7 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    warning: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 2L2 17h16L10 2z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M10 8v4M10 14v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  };

  return (
    <div className={`toast-notification toast-${type}`}>
      {icons[type]}
      {message}
    </div>
  );
};

// Auto-resize function for textareas
const autoResizeTextarea = (element: HTMLTextAreaElement | null) => {
  if (!element) return;
  element.style.height = 'auto';
  element.style.height = element.scrollHeight + 'px';
};

export default function VisualPanel({ 
  data, 
  updateField, 
  columnColors, 
  cloudColors, 
  updateColumnColors = () => {}, 
  updateCloudColors = () => {},
  onFieldAdded = () => {},
  isLoading = false
}: VisualProps) {

  const navigate = useNavigate();
  console.log('=== Visual Render ===');
  console.log('columnColors prop received:', columnColors);
  const [showCustomize, setShowCustomize] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const initialColumns: ColumnConfig[] = [
    { title: "Activities", field: "activities", cards: [{ value: data.activities || "" }] },
    { title: "Objectives", field: "objectives", cards: [{ value: data.objectives || "" }] },
    { title: "Aim", field: "aim", cards: [{ value: data.aim || "" }] },
    { title: "Goal", field: "goal", cards: [{ value: data.goal || "" }] },
  ];

  const [columns, setColumns] = useState<ColumnConfig[]>(initialColumns);

  const defaultColumnColors = {
    activities: { bg: "#8C6BDC", text: "#ffffff" },
    objectives: { bg: "#A07CFD", text: "#ffffff" },
    aim: { bg: "#C074E0", text: "#ffffff" },
    goal: { bg: "#8C6BDC", text: "#ffffff" },
  };

  const [localColumnColors, setLocalColumnColors] = useState<{ [field in keyof Data]?: { bg: string; text: string } }>(defaultColumnColors);

  const [clouds, setClouds] = useState<string[]>(data.externalInfluences ? JSON.parse(data.externalInfluences) : [""]);
  const defaultCloudColor = { bg: "#cbe3ff", text: "#333333" };
  const [localCloudColors, setLocalCloudColors] = useState<{ bg: string; text: string }[]>(clouds.map(() => defaultCloudColor));

  // Update local colors when props change
  useEffect(() => {
    if (columnColors) {
      setLocalColumnColors(columnColors);
    }
  }, [columnColors]);

  useEffect(() => {
    if (cloudColors && cloudColors.length > 0) {
      setLocalCloudColors([...cloudColors]);
    }
  }, [cloudColors]);

  const effectiveColumnColors = (columnColors && Object.keys(columnColors).length > 0) 
  ? columnColors 
  : localColumnColors;
  const effectiveCloudColors = (cloudColors && cloudColors.length > 0) 
    ? cloudColors 
    : localCloudColors;

  useEffect(() => {
    setColumns((cols) =>
      cols.map((col) => {
        const values = (() => {
          if (!data[col.field]) return [""];
          try {
            const parsed = JSON.parse(data[col.field]);
            return Array.isArray(parsed) ? parsed : [data[col.field]];
          } catch {
            return [data[col.field]];
          }
        })();

        return { ...col, cards: values.map((v) => ({ value: v })) };
      })
    );

    if (data.externalInfluences) {
      try {
        const parsedClouds: string[] = JSON.parse(data.externalInfluences);
        setClouds(parsedClouds);
        if (!cloudColors) {
          setLocalCloudColors(parsedClouds.map((_, idx) => localCloudColors[idx] || { bg: "#cbe3ff", text: "#333" }));
        }
      } catch {
        setClouds([data.externalInfluences]);
      }
    }
  }, [data]);

  useEffect(() => {
    if (!data.externalInfluences) {
      setClouds([""]);
      if (!cloudColors) {
        setLocalCloudColors([{ bg: "#cbe3ff", text: "#333" }]);
      } else if (updateCloudColors) {
        updateCloudColors([{ bg: "#cbe3ff", text: "#333" }]);
      }
      return;
    }
    
    try {
      const influenceArray: string[] = JSON.parse(data.externalInfluences);
      setClouds(influenceArray);
      
      if (cloudColors && cloudColors.length > 0) {
        return;
      }
      
      const requiredColorCount = influenceArray.length;
      const currentColors = effectiveCloudColors;
      
      if (currentColors.length !== requiredColorCount) {
        const newColors = Array(requiredColorCount).fill(null).map((_, idx) => 
          currentColors[idx] || { bg: "#cbe3ff", text: "#333" }
        );
        
        if (updateCloudColors) {
          updateCloudColors(newColors);
        } else {
          setLocalCloudColors(newColors);
        }
      }
    } catch {
      setClouds([data.externalInfluences]);
      if (!cloudColors && updateCloudColors) {
        updateCloudColors([{ bg: "#cbe3ff", text: "#333" }]);
      }
    }
  }, [data.externalInfluences]);

  const handleAddCard = (colIndex: number) => {
    const newColumns = [...columns];
    if (newColumns[colIndex].cards.length >= 10) {
      setToast({ message: "Maximum 10 cards per column reached", type: "warning" });
      return;
    }
    newColumns[colIndex].cards.push({ value: "" });
    setColumns(newColumns);
    updateField(newColumns[colIndex].field, JSON.stringify(newColumns[colIndex].cards.map(c => c.value)));
    
    const fieldTitle = newColumns[colIndex].title;
    setToast({ message: `New ${fieldTitle} field added in the form! Check the form panel.`, type: "success" });
    onFieldAdded(newColumns[colIndex].field);
  };

  const handleRemoveCard = (colIndex: number, cardIndex: number) => {
    const newColumns = [...columns];
    if (newColumns[colIndex].cards.length <= 1) return;
    newColumns[colIndex].cards.splice(cardIndex, 1);
    setColumns(newColumns);
    updateField(newColumns[colIndex].field, JSON.stringify(newColumns[colIndex].cards.map(c => c.value)));
  };

  const handleCardTextChange = (colIndex: number, cardIndex: number, value: string) => {
    const newColumns = [...columns];
    newColumns[colIndex].cards[cardIndex].value = value;
    setColumns(newColumns);
    updateField(newColumns[colIndex].field, JSON.stringify(newColumns[colIndex].cards.map(c => c.value)));
  };

  const handleColumnColorChange = (field: keyof Data, type: "bg" | "text", value: string) => {
    if (updateColumnColors) {
      const newColors = {
        ...effectiveColumnColors,
        [field]: { ...effectiveColumnColors[field], [type]: value }
      };
      updateColumnColors(newColors);
    } else {
      setLocalColumnColors(prev => ({
        ...prev,
        [field]: { ...prev[field], [type]: value }
      }));
    }
  };

  const handleAddCloud = (index: number) => {
    if (clouds.length >= 10) {
      setToast({ message: "Maximum 10 external influences reached", type: "warning" });
      return;
    }
    const newClouds = [...clouds];
    newClouds.splice(index + 1, 0, "");
    setClouds(newClouds);

    const currentCloudColor = effectiveCloudColors[index] || { bg: "#cbe3ff", text: "#333" };
    
    if (updateCloudColors) {
      const newColors = [...effectiveCloudColors];
      newColors.splice(index + 1, 0, { ...currentCloudColor });
      updateCloudColors(newColors);
    } else {
      const newColors = [...localCloudColors];
      newColors.splice(index + 1, 0, { ...currentCloudColor });
      setLocalCloudColors(newColors);
    }

    updateField("externalInfluences", JSON.stringify(newClouds));
    
    setToast({ message: "New External Influence field added in the form! Check the form.", type: "success" });
    onFieldAdded("externalInfluences");
  };

  const handleRemoveCloud = (index: number) => {
    if (clouds.length <= 1) return;
    const newClouds = clouds.filter((_, i) => i !== index);
    setClouds(newClouds);

    if (updateCloudColors) {
      const newColors = effectiveCloudColors.filter((_, i) => i !== index);
      updateCloudColors(newColors);
    } else {
      const newColors = localCloudColors.filter((_, i) => i !== index);
      setLocalCloudColors(newColors);
    }
    
    updateField("externalInfluences", JSON.stringify(newClouds));
  };

  const handleCloudChange = (index: number, value: string) => {
    const newClouds = [...clouds];
    newClouds[index] = value;
    setClouds(newClouds);
    updateField("externalInfluences", JSON.stringify(newClouds));
  };

  const handleCloudColorChange = (type: "bg" | "text", value: string) => {
    if (updateCloudColors) {
      const newColors = effectiveCloudColors.map(c => ({ ...c, [type]: value }));
      updateCloudColors(newColors);
    } else {
      setLocalCloudColors(prev => prev.map(c => ({ ...c, [type]: value })));
    }
  };

  const handleExport = async () => {
  if (exportRef.current) {
    try {
      await exportVisualDiagram(
        exportRef.current, 
        data.projectTitle || 'Theory-of-Change',
        () => {
          console.log('🚀 Redirecting to subscription page...');
          navigate('/plans');
        }
      );
      
    } catch (error) {
      console.error('Export failed:', error);
      setToast({ message: "Export failed. Please try again.", type: "error" });
    }
  }
};

  if (isLoading) {
    return (
      <div className="right-panel-container">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="right-panel-container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="panel-buttons">
        <button className="btn customize" onClick={() => setShowCustomize(!showCustomize)}>
          {showCustomize ? "Hide Customisation" : "Customise"}
        </button>
        <button className="btn export" onClick={handleExport}>
          Export
        </button>
      </div>
      
      <div ref={exportRef} className="export-content">
        <div className="influence-cloud-wrapper">
          <div className="influence-title">External Influences</div>
          <div className="influence-cloud-row">
            {clouds.map((value, idx) => (
              <div key={idx} className="influence-cloud-wrapper-item">
                <div
                  className="influence-cloud"
                  style={{
                    backgroundColor: effectiveCloudColors[idx]?.bg || "#cbe3ff",
                    color: effectiveCloudColors[idx]?.text || "#333",
                  }}
                >
                  <div className="cloud-value">
                    <textarea
                      ref={(el) => autoResizeTextarea(el)}
                      value={value}
                      disabled={!showCustomize}
                      onChange={(e) => {
                        handleCloudChange(idx, e.target.value);
                        autoResizeTextarea(e.target);
                      }}
                    />
                  </div>
                </div>

                {showCustomize && (
                  <div className="cloud-buttons">
                    {clouds.length < 10 && (
                      <button className="add-cloud-btn" onClick={() => handleAddCloud(idx)}>+</button>
                    )}
                    {clouds.length > 1 && idx === clouds.length - 1 && (
                      <button className="remove-cloud-btn" onClick={() => handleRemoveCloud(idx)}>−</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {showCustomize && (
            <div className="cloud-customize-controls">
              <span>Cloud</span>
              <input
                type="color"
                className="cloud-color-picker"
                value={effectiveCloudColors[0]?.bg || "#cbe3ff"}
                onChange={(e) => handleCloudColorChange("bg", e.target.value)}
              />
              <span>Text:</span>
              <input
                type="color"
                className="cloud-color-picker"
                value={effectiveCloudColors[0]?.text || "#333"}
                onChange={(e) => handleCloudColorChange("text", e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="right-panel">
          {columns.map((col, colIndex) => (
            <React.Fragment key={col.title}>
              <div className="outer-card">
                {showCustomize && (
                  <div className="customize-controls-column">
                    <label className="color-picker-wrapper">
                      Card:{" "}
                      <input
                        type="color"
                        className="color-picker-circle"
                        value={effectiveColumnColors[col.field]?.bg || "#8C6BDC"}
                        onChange={(e) => handleColumnColorChange(col.field, "bg", e.target.value)}
                      />
                    </label>
                    <label className="color-picker-wrapper">
                      Text:{" "}
                      <input
                        type="color"
                        className="color-picker-circle"
                        value={effectiveColumnColors[col.field]?.text || "#fff"}
                        onChange={(e) => handleColumnColorChange(col.field, "text", e.target.value)}
                      />
                    </label>
                  </div>
                )}

                {col.cards.map((card, idx) => (
                  <div className="card-container" key={idx}>
                    <div
                      className="flow-card"
                      style={{
                        backgroundColor: effectiveColumnColors[col.field]?.bg || "#8C6BDC",
                        color: effectiveColumnColors[col.field]?.text || "#fff",
                      }}
                    >
                      <div className="card-title">{idx === 0 ? col.title : ""}</div>
                      <div className="card-value">
                        <textarea
                          ref={(el) => autoResizeTextarea(el)}
                          value={card.value}
                          disabled={!showCustomize}
                          onChange={(e) => {
                            handleCardTextChange(colIndex, idx, e.target.value);
                            autoResizeTextarea(e.target);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <div className="add-remove-wrapper">
                  {showCustomize && (
                    <>
                      <button
                        className="add-card-btn"
                        onClick={() => handleAddCard(colIndex)}
                      >
                        +
                      </button>
                      {col.cards.length > 1 && (
                        <button
                          className="remove-card-btn"
                          onClick={() => handleRemoveCard(colIndex, col.cards.length - 1)}
                        >
                          −
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              {colIndex < columns.length - 1 && <span className="flow-arrow">→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}