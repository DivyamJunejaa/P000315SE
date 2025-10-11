import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import "../style/Export.css"

// Get user plan from localStorage
const getUserPlanFromStorage = (): 'free' | 'pro' | 'premium' => {
  const userPlan = localStorage.getItem('userPlan');
  if (userPlan === 'pro' || userPlan === 'premium') {
    return userPlan as 'free' | 'pro' | 'premium';
  }
  return 'free';
};

// Check if user has export access
const hasExportAccess = (): boolean => {
  const userPlan = getUserPlanFromStorage();
  const hasAccess = userPlan === 'pro' || userPlan === 'premium';
  
  console.log('🔒 Export Access Check:', {
    userPlan,
    hasAccess,
    storedPlan: localStorage.getItem('userPlan'),
    storedPlanId: localStorage.getItem('planId')
  });
  
  return hasAccess;
};

// Subscription check modal
const showSubscriptionRequiredModal = (onUpgradeClick?: () => void): Promise<void> => {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'export-modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'export-modal subscription-modal';
    
    modal.innerHTML = `
      <div class="subscription-required-content">
        <div class="lock-icon">🔒</div>
        <h3>Premium Feature</h3>
        <p>Export functionality is available for Pro and Premium subscribers only.</p>
        <div class="feature-benefits">
          <div class="benefit-item">✓ Export as PNG</div>
          <div class="benefit-item">✓ Export as PDF</div>
          <div class="benefit-item">✓ High-quality output</div>
        </div>
        <div class="export-modal-actions">
          <button class="export-modal-btn upgrade-btn">Upgrade Now</button>
          <button class="export-modal-btn cancel">Maybe Later</button>
        </div>
      </div>
    `;
    
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    modal.querySelector('.upgrade-btn')?.addEventListener('click', () => {
      document.body.removeChild(overlay);
      if (onUpgradeClick) {
        onUpgradeClick(); // Navigate to /subscription
      }
      resolve();
    });
    
    modal.querySelector('.cancel')?.addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve();
    });
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        resolve();
      }
    });
  });
};

const showExportModal = (): Promise<string | null> => {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'export-modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'export-modal';
    
    let selectedFormat = 'png';
    
    modal.innerHTML = `
      <h3>Export Diagram</h3>
      <p>Choose your preferred export format</p>
      <div class="export-format-buttons">
        <button class="export-format-btn selected" data-format="png">
          <div>📄 PNG</div>
          <small style="color: inherit; opacity: 0.8;">Image file</small>
        </button>
        <button class="export-format-btn" data-format="pdf">
          <div>📋 PDF</div>
          <small style="color: inherit; opacity: 0.8;">Document file</small>
        </button>
      </div>
      <div class="export-modal-actions">
        <button class="export-modal-btn cancel">Cancel</button>
        <button class="export-modal-btn export">Export</button>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    const formatButtons = modal.querySelectorAll('.export-format-btn');
    formatButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        formatButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedFormat = btn.getAttribute('data-format') || 'png';
      });
    });
    
    modal.querySelector('.cancel')?.addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve(null);
    });
    
    modal.querySelector('.export')?.addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve(selectedFormat);
    });
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        resolve(null);
      }
    });
  });
};

// Main export function - READS FROM LOCALSTORAGE
export const exportVisualDiagram = async (
  element: HTMLElement, 
  filename: string = 'theory-of-change',
  onUpgradeClick?: () => void
) => {
  try {
    // Check export access from localStorage
    console.log('🚀 Export initiated');
    
    if (!hasExportAccess()) {
      console.log('❌ User does not have export access - showing upgrade modal');
      await showSubscriptionRequiredModal(onUpgradeClick);
      return; // Stop execution if user doesn't have access
    }
    
    console.log('✅ User has export access - proceeding with export');

    const format = await showExportModal();
    
    if (!format) {
      return;
    }

    // Add export class
    element.classList.add('export-mode');

    // Hide sidebar
    const sidebar = document.querySelector('.sidebar') as HTMLElement;
    const originalSidebarDisplay = sidebar ? sidebar.style.display : '';
    if (sidebar) {
      sidebar.style.display = 'none';
    }

    // Hide customization controls
    const customizeControls = element.querySelectorAll(
      '.customize-controls-column, .cloud-customize-controls, .add-card-btn, .remove-card-btn, .add-cloud-btn, .remove-cloud-btn, .cloud-buttons, .add-remove-wrapper'
    );
    customizeControls.forEach((el) => {
      (el as HTMLElement).style.display = 'none';
    });

    // Store original styles for ALL containers and elements
    const originalStyles: Array<{
      el: HTMLElement;
      height: string;
      minHeight: string;
      maxHeight: string;
      overflow: string;
      whiteSpace: string;
    }> = [];

    // Force expand all parent containers (cards, clouds, wrappers) - HEIGHT ONLY
    const containers = element.querySelectorAll(
      '.flow-card, .influence-cloud, .card-container, .outer-card, .card-value, .cloud-value, .flow-row'
    );
    
    containers.forEach((container) => {
      const el = container as HTMLElement;
      originalStyles.push({
        el: el,
        height: el.style.height,
        minHeight: el.style.minHeight,
        maxHeight: el.style.maxHeight,
        overflow: el.style.overflow,
        whiteSpace: el.style.whiteSpace
      });
      
      // Force containers to expand and NOT clip children
      el.style.height = 'auto';
      el.style.minHeight = 'auto';
      el.style.maxHeight = 'none';
      el.style.overflow = 'visible'; 
      el.style.whiteSpace = 'normal';
    });
    
    // ensure any wrapper divs don't clip
    const allDivs = element.querySelectorAll('div');
    const divOriginalStyles: Array<{ el: HTMLElement; overflow: string }> = [];
    allDivs.forEach((div) => {
      const el = div as HTMLElement;
      divOriginalStyles.push({
        el: el,
        overflow: el.style.overflow
      });
      // Force all divs to show overflow content
      if (el.style.overflow === 'hidden' || el.style.overflow === 'auto' || el.style.overflow === 'scroll') {
        el.style.overflow = 'visible';
      }
    });

    // Force all textareas to expand to their full scrollHeight
    const allTextareas = element.querySelectorAll('textarea');
    const originalTextareaStyles: Array<{
      el: HTMLTextAreaElement;
      height: string;
      minHeight: string;
      maxHeight: string;
      overflow: string;
      resize: string;
      display: string;
    }> = [];
    
    // Store textarea replacements for later cleanup
    const textareaReplacements: Array<{ textarea: HTMLTextAreaElement; replacement: HTMLDivElement }> = [];

    allTextareas.forEach((textarea) => {
      originalTextareaStyles.push({
        el: textarea,
        height: textarea.style.height,
        minHeight: textarea.style.minHeight,
        maxHeight: textarea.style.maxHeight,
        overflow: textarea.style.overflow,
        resize: textarea.style.resize,
        display: textarea.style.display
      });
      
      // Create a div replacement that will render the text properly
      const replacement = document.createElement('div');
      replacement.className = 'textarea-replacement';
      replacement.textContent = textarea.value;
      
      // Copy all computed styles from textarea to div
      const computedStyle = window.getComputedStyle(textarea);
      replacement.style.cssText = textarea.style.cssText;
      replacement.style.width = computedStyle.width;
      replacement.style.height = 'auto';
      replacement.style.minHeight = '0';
      replacement.style.maxHeight = 'none';
      replacement.style.overflow = 'visible';
      replacement.style.whiteSpace = 'pre-wrap';
      replacement.style.wordWrap = 'break-word';
      replacement.style.wordBreak = 'break-word';
      replacement.style.fontFamily = computedStyle.fontFamily;
      replacement.style.fontSize = computedStyle.fontSize;
      replacement.style.fontWeight = computedStyle.fontWeight;
      replacement.style.lineHeight = computedStyle.lineHeight;
      replacement.style.padding = computedStyle.padding;
      replacement.style.border = computedStyle.border;
      replacement.style.borderRadius = computedStyle.borderRadius;
      replacement.style.backgroundColor = computedStyle.backgroundColor;
      replacement.style.color = computedStyle.color;
      replacement.style.boxSizing = 'border-box';
      
      // Hide textarea and insert replacement
      textarea.style.display = 'none';
      textarea.parentNode?.insertBefore(replacement, textarea);
      
      textareaReplacements.push({ textarea, replacement });
    });

    // Wait for layout to settle and force another reflow
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Second pass: Re-check all textareas after initial layout
    allTextareas.forEach((textarea) => {
      const computedStyle = window.getComputedStyle(textarea);
      const width = computedStyle.width;
      textarea.style.width = width;
      
      // Reset height to recalculate
      textarea.style.height = 'auto';
      void textarea.offsetHeight;
      void textarea.scrollHeight;
      const finalHeight = textarea.scrollHeight;
      textarea.style.height = (finalHeight + 8) + 'px';
    });
    
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Third pass: Final verification
    allTextareas.forEach((textarea) => {
      void textarea.offsetHeight;
      const verifyHeight = textarea.scrollHeight;
      if (parseInt(textarea.style.height) < verifyHeight) {
        textarea.style.height = (verifyHeight + 8) + 'px';
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 200));

    // Capture with html2canvas
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      useCORS: true,
      scale: 2,
      logging: false,
      width: element.scrollWidth,
      height: element.scrollHeight,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc) => {
        // Additional fixes in the cloned document
        const clonedElement = clonedDoc.querySelector('.export-mode');
        if (clonedElement) {
          // Force all containers in clone to expand
          const clonedContainers = clonedElement.querySelectorAll(
            '.flow-card, .influence-cloud, .card-container, .outer-card, .card-value, .cloud-value'
          );
          clonedContainers.forEach((el) => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.height = 'auto';
            htmlEl.style.minHeight = 'auto';
            htmlEl.style.maxHeight = 'none';
            htmlEl.style.overflow = 'visible';
          });

          // Force all textareas in clone - MORE AGGRESSIVE
          const clonedTextareas = clonedElement.querySelectorAll('textarea');
          clonedTextareas.forEach((textarea) => {
            const ta = textarea as HTMLTextAreaElement;
            
            // Get computed width first
            const computedStyle = window.getComputedStyle(ta);
            const width = computedStyle.width;
            
            ta.style.height = 'auto';
            ta.style.minHeight = '0';
            ta.style.maxHeight = 'none';
            ta.style.overflow = 'hidden';
            ta.style.resize = 'none';
            ta.style.whiteSpace = 'pre-wrap';
            ta.style.wordWrap = 'break-word';
            ta.style.boxSizing = 'border-box';
            ta.style.width = width;
            
            // Multiple reflow passes for accurate height
            void ta.offsetHeight;
            void ta.scrollHeight;
            let scrollHeight = ta.scrollHeight;
            ta.style.height = (scrollHeight + 8) + 'px';
            void ta.offsetHeight;
            scrollHeight = ta.scrollHeight;
            ta.style.height = (scrollHeight + 8) + 'px';
            void ta.offsetHeight;
            scrollHeight = ta.scrollHeight;
            ta.style.height = (scrollHeight + 8) + 'px';
          });
        }
      }
    });

    // Restore all container styles
    originalStyles.forEach(({ el, height, minHeight, maxHeight, overflow }) => {
      el.style.height = height;
      el.style.minHeight = minHeight;
      el.style.maxHeight = maxHeight;
      el.style.overflow = overflow;
    });

    // Restore div overflow styles
    divOriginalStyles.forEach(({ el, overflow }) => {
      el.style.overflow = overflow;
    });

    // Restore textarea styles
    originalTextareaStyles.forEach(({ el, height, minHeight, maxHeight, overflow, resize }) => {
      el.style.height = height;
      el.style.minHeight = minHeight;
      el.style.maxHeight = maxHeight;
      el.style.overflow = overflow;
      el.style.resize = resize;
    });

    // Remove export mode
    element.classList.remove('export-mode');

    // Restore sidebar
    if (sidebar) {
      sidebar.style.display = originalSidebarDisplay;
    }

    // Restore controls
    customizeControls.forEach((el) => {
      (el as HTMLElement).style.display = '';
    });
    
    // Cleanup textarea replacements
    textareaReplacements.forEach(({ textarea, replacement }) => {
      replacement.remove();
      textarea.style.display = '';
    });
    
    if (format.toLowerCase() === 'pdf') {
      const imgData = canvas.toDataURL('image/png', 1.0);
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      const a4Width = 595.28;
      const a4Height = 841.89;
      
      const orientation = imgWidth > imgHeight ? 'landscape' : 'portrait';
      const pageWidth = orientation === 'landscape' ? a4Height : a4Width;
      const pageHeight = orientation === 'landscape' ? a4Width : a4Height;
      
      const padding = 20;
      const availableWidth = pageWidth - (2 * padding);
      const availableHeight = pageHeight - (2 * padding);
      
      const scaleX = availableWidth / imgWidth;
      const scaleY = availableHeight / imgHeight;
      const scale = Math.min(scaleX, scaleY);
      
      const scaledWidth = imgWidth * scale;
      const scaledHeight = imgHeight * scale;
      
      const x = (pageWidth - scaledWidth) / 2;
      const y = (pageHeight - scaledHeight) / 2;
      
      const pdf = new jsPDF({
        orientation: orientation,
        unit: 'pt',
        format: 'a4',
        compress: true
      });
      
      pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight, undefined, 'FAST');
      pdf.save(`${filename}.pdf`);
    } else {
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    }
  } catch (error) {
    console.error('Export failed:', error);
    alert('Export failed. Please try again.');
    throw error;
  }
};