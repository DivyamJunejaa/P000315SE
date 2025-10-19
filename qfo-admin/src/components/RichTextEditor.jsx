import React, { useState } from "react";
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

const RichTextEditor = ({ 
  value, 
  onChange, 
  placeholder = "Enter content here...",
  height = 400,
  preview = "edit"
}) => {
  const [mode] = useState(preview);

  const editorStyle = {
    backgroundColor: 'transparent',
  };

  const containerStyle = {
    border: "1px solid #d1d5db",
    borderRadius: 8,
    overflow: "hidden",
    transition: "border-color 0.2s ease"
  };

  return (
    <div style={containerStyle}>
      <MDEditor
        value={value}
        onChange={onChange}
        preview={mode}
        height={height}
        data-color-mode="light"
        style={editorStyle}
        textareaProps={{
          placeholder,
          style: {
            fontSize: 14,
            fontFamily: 'inherit',
            lineHeight: 1.5
          }
        }}
        commands={[
          // Basic formatting
          'bold', 'italic', 'strikethrough', 'hr',
          // Headers
          'title', 'title2', 'title3', 'title4', 'title5', 'title6',
          // Lists
          'unorderedListCommand', 'orderedListCommand', 'checkedListCommand',
          // Links and quotes
          'link', 'quote', 'code', 'codeBlock',
          // Preview controls
          'preview', 'fullscreen'
        ]}
        extraCommands={[]}
      />
    </div>
  );
};

export default RichTextEditor;