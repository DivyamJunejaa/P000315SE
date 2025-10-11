
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VisualPanel from '../components/VisualPanel';
import { Data } from '../pages/App';

jest.mock('../utils/exportUtils', () => ({
  exportVisualDiagram: jest.fn().mockResolvedValue(undefined)
}));

const createMockData = (): Data => ({
  projectTitle: 'Test Project',
  activities: '["Test Activity"]',
  objectives: '["Test Objective"]',
  aim: '["Test Aim"]',
  goal: '["Test Goal"]',
  beneficiaries: 'Test Beneficiaries',
  externalInfluences: '["Test Influence"]'
});

describe('VisualPanel - Basic Rendering', () => {
  test('renders without crashing', () => {
    const { container } = render(
      <VisualPanel data={createMockData()} updateField={jest.fn()} />
    );
    expect(container).toBeInTheDocument();
  });

  test('displays all column titles', () => {
    render(<VisualPanel data={createMockData()} updateField={jest.fn()} />);
    
    expect(screen.getByText('Activities')).toBeInTheDocument();
    expect(screen.getByText('Objectives')).toBeInTheDocument();
    expect(screen.getByText('Aim')).toBeInTheDocument();
    expect(screen.getByText('Goal')).toBeInTheDocument();
    expect(screen.getByText('External Influences')).toBeInTheDocument();
  });

  test('shows loading spinner when isLoading is true', () => {
    render(<VisualPanel data={createMockData()} updateField={jest.fn()} isLoading={true} />);
    expect(screen.getByText('Loading project data...')).toBeInTheDocument();
    expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
  });

  test('renders export content with ref', () => {
    render(<VisualPanel data={createMockData()} updateField={jest.fn()} />);
    const exportContent = document.querySelector('.export-content');
    expect(exportContent).toBeInTheDocument();
  });
});

describe('VisualPanel - Customization Mode', () => {
  test('toggles customization mode', async () => {
    render(<VisualPanel data={createMockData()} updateField={jest.fn()} />);
    
    const customizeBtn = screen.getByText('Customise');
    await userEvent.click(customizeBtn);
    
    expect(screen.getByText('Hide Customisation')).toBeInTheDocument();
    
    await userEvent.click(screen.getByText('Hide Customisation'));
    expect(screen.getByText('Customise')).toBeInTheDocument();
  });

  test('textareas are disabled when not customizing', () => {
    render(<VisualPanel data={createMockData()} updateField={jest.fn()} />);
    const textareas = screen.getAllByRole('textbox');
    textareas.forEach(ta => expect(ta).toBeDisabled());
  });

  test('textareas are enabled when customizing', async () => {
    render(<VisualPanel data={createMockData()} updateField={jest.fn()} />);
    await userEvent.click(screen.getByText('Customise'));
    const textareas = screen.getAllByRole('textbox');
    textareas.forEach(ta => expect(ta).not.toBeDisabled());
  });
});

describe('VisualPanel - Card Management', () => {
  test('adds new card to column', async () => {
    const mockUpdateField = jest.fn();
    const mockOnFieldAdded = jest.fn();
    
    render(
      <VisualPanel 
        data={createMockData()} 
        updateField={mockUpdateField}
        onFieldAdded={mockOnFieldAdded}
      />
    );
    
    await userEvent.click(screen.getByText('Customise'));
    
    const addButtons = screen.getAllByRole('button', { name: '+' });
    const cardAddButtons = addButtons.filter(btn => 
      btn.closest('.add-remove-wrapper') !== null
    );
    
    await userEvent.click(cardAddButtons[0]);
    
    expect(mockUpdateField).toHaveBeenCalled();
    expect(mockOnFieldAdded).toHaveBeenCalledWith('activities');
  });

  test('prevents adding more than 10 cards', async () => {
    const maxData: Data = {
      ...createMockData(),
      activities: JSON.stringify(Array(10).fill('Activity'))
    };
    
    render(<VisualPanel data={maxData} updateField={jest.fn()} />);
    
    await userEvent.click(screen.getByText('Customise'));
    
    await waitFor(() => {
      expect(screen.getByText('Hide Customisation')).toBeInTheDocument();
    });
    
    const addButtons = screen.getAllByRole('button', { name: '+' });
    const cardAddButtons = addButtons.filter(btn => 
      btn.closest('.add-remove-wrapper') !== null
    );
    
    fireEvent.click(cardAddButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/maximum 10 cards per column/i)).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  test('removes card from column with multiple cards', async () => {
    const data: Data = {
      ...createMockData(),
      activities: '["Card 1", "Card 2"]'
    };
    
    const mockUpdateField = jest.fn();
    render(<VisualPanel data={data} updateField={mockUpdateField} />);
    
    await userEvent.click(screen.getByText('Customise'));
    
    const removeButtons = screen.getAllByRole('button', { name: '−' });
    await userEvent.click(removeButtons[0]);
    
    expect(mockUpdateField).toHaveBeenCalled();
  });

  test('does not remove card when only 1 card exists', async () => {
    const mockUpdateField = jest.fn();
    render(<VisualPanel data={createMockData()} updateField={mockUpdateField} />);
    
    await userEvent.click(screen.getByText('Customise'));
    
    // No remove buttons should show when each column has only 1 card
    const removeButtons = screen.queryAllByRole('button', { name: '−' }).filter(btn =>
      btn.classList.contains('remove-card-btn')
    );
    expect(removeButtons.length).toBe(0);
  });

  test('updates card text', async () => {
    const mockUpdateField = jest.fn();
    render(<VisualPanel data={createMockData()} updateField={mockUpdateField} />);
    
    await userEvent.click(screen.getByText('Customise'));
    
    const textareas = screen.getAllByRole('textbox');
    await userEvent.clear(textareas[0]);
    await userEvent.type(textareas[0], 'New Text');
    
    expect(mockUpdateField).toHaveBeenCalled();
  });
});

describe('VisualPanel - Cloud Management', () => {
  test('adds new cloud', async () => {
    const mockUpdateField = jest.fn();
    const mockOnFieldAdded = jest.fn();
    
    render(
      <VisualPanel 
        data={createMockData()} 
        updateField={mockUpdateField}
        onFieldAdded={mockOnFieldAdded}
      />
    );
    
    await userEvent.click(screen.getByText('Customise'));
    
    await waitFor(() => {
      expect(screen.getByText('Hide Customisation')).toBeInTheDocument();
    });
    
    const cloudButtons = screen.getAllByRole('button', { name: '+' }).filter(btn => 
      btn.classList.contains('add-cloud-btn')
    );
    
    await userEvent.click(cloudButtons[0]);
    
    expect(mockUpdateField).toHaveBeenCalledWith('externalInfluences', expect.any(String));
    expect(mockOnFieldAdded).toHaveBeenCalledWith('externalInfluences');
  });

  test('prevents adding more than 10 clouds', async () => {
    const maxData: Data = {
      ...createMockData(),
      externalInfluences: JSON.stringify(Array(10).fill('Cloud'))
    };
    
    render(<VisualPanel data={maxData} updateField={jest.fn()} />);
    
    await userEvent.click(screen.getByText('Customise'));
    
    await waitFor(() => {
      expect(screen.getByText('Hide Customisation')).toBeInTheDocument();
    });
    
    const cloudButtons = screen.queryAllByRole('button', { name: '+' }).filter(btn => 
      btn.classList.contains('add-cloud-btn')
    );
    
    expect(cloudButtons.length).toBe(0);
    
    const cloudTextareas = document.querySelectorAll('.cloud-value textarea');
    expect(cloudTextareas.length).toBe(10);
  });

  test('removes cloud when multiple exist', async () => {
    const data: Data = {
      ...createMockData(),
      externalInfluences: '["Cloud 1", "Cloud 2"]'
    };
    
    const mockUpdateField = jest.fn();
    render(<VisualPanel data={data} updateField={mockUpdateField} />);
    
    await userEvent.click(screen.getByText('Customise'));
    
    const removeButtons = screen.getAllByRole('button', { name: '−' }).filter(btn =>
      btn.classList.contains('remove-cloud-btn')
    );
    
    await userEvent.click(removeButtons[0]);
    expect(mockUpdateField).toHaveBeenCalled();
  });

  test('does not show remove button for single cloud', async () => {
    render(<VisualPanel data={createMockData()} updateField={jest.fn()} />);
    
    await userEvent.click(screen.getByText('Customise'));
    
    const removeButtons = screen.queryAllByRole('button', { name: '−' }).filter(btn =>
      btn.classList.contains('remove-cloud-btn')
    );
    
    expect(removeButtons.length).toBe(0);
  });

  test('updates cloud text', async () => {
    const mockUpdateField = jest.fn();
    render(<VisualPanel data={createMockData()} updateField={mockUpdateField} />);
    
    await userEvent.click(screen.getByText('Customise'));
    
    const cloudTextareas = document.querySelectorAll('.cloud-value textarea');
    await userEvent.clear(cloudTextareas[0] as HTMLElement);
    await userEvent.type(cloudTextareas[0] as HTMLElement, 'Updated');
    
    expect(mockUpdateField).toHaveBeenCalled();
  });

  test('new cloud inherits color from previous cloud', async () => {
    const mockUpdateField = jest.fn();
    const mockUpdateCloudColors = jest.fn();
    const customColors = [{ bg: '#ff0000', text: '#ffffff' }];
    
    render(
      <VisualPanel 
        data={createMockData()} 
        updateField={mockUpdateField}
        cloudColors={customColors}
        updateCloudColors={mockUpdateCloudColors}
      />
    );
    
    await userEvent.click(screen.getByText('Customise'));
    
    await waitFor(() => {
      expect(screen.getByText('Hide Customisation')).toBeInTheDocument();
    });
    
    const cloudButtons = screen.getAllByRole('button', { name: '+' }).filter(btn => 
      btn.classList.contains('add-cloud-btn')
    );
    
    await userEvent.click(cloudButtons[0]);
    
    expect(mockUpdateCloudColors).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ bg: '#ff0000', text: '#ffffff' })
      ])
    );
  });

  test('adds cloud without updateCloudColors callback', async () => {
    const mockUpdateField = jest.fn();
    
    render(
      <VisualPanel 
        data={createMockData()} 
        updateField={mockUpdateField}
      />
    );
    
    await userEvent.click(screen.getByText('Customise'));
    
    const cloudButtons = screen.getAllByRole('button', { name: '+' }).filter(btn => 
      btn.classList.contains('add-cloud-btn')
    );
    
    await userEvent.click(cloudButtons[0]);
    
    expect(mockUpdateField).toHaveBeenCalled();
  });

  test('removes cloud without updateCloudColors callback', async () => {
    const data: Data = {
      ...createMockData(),
      externalInfluences: '["Cloud 1", "Cloud 2"]'
    };
    
    const mockUpdateField = jest.fn();
    render(<VisualPanel data={data} updateField={mockUpdateField} />);
    
    await userEvent.click(screen.getByText('Customise'));
    
    const removeButtons = screen.getAllByRole('button', { name: '−' }).filter(btn =>
      btn.classList.contains('remove-cloud-btn')
    );
    
    await userEvent.click(removeButtons[0]);
    expect(mockUpdateField).toHaveBeenCalled();
  });
});

describe('VisualPanel - Color Customisation', () => {
  test('updates column background color with callback', async () => {
    const mockUpdateColumnColors = jest.fn();
    
    render(
      <VisualPanel 
        data={createMockData()} 
        updateField={jest.fn()}
        updateColumnColors={mockUpdateColumnColors}
      />
    );
    
    await userEvent.click(screen.getByText('Customise'));
    
    const colorPickers = document.querySelectorAll('.color-picker-circle');
    fireEvent.change(colorPickers[0], { target: { value: '#FF0000' } });
    
    expect(mockUpdateColumnColors).toHaveBeenCalled();
  });

  test('updates column text color with callback', async () => {
    const mockUpdateColumnColors = jest.fn();
    
    render(
      <VisualPanel 
        data={createMockData()} 
        updateField={jest.fn()}
        updateColumnColors={mockUpdateColumnColors}
      />
    );
    
    await userEvent.click(screen.getByText('Customise'));
    
    const colorPickers = document.querySelectorAll('.color-picker-circle');
    fireEvent.change(colorPickers[1], { target: { value: '#000000' } });
    
    expect(mockUpdateColumnColors).toHaveBeenCalled();
  });

  test('updates column color without callback', async () => {
    render(
      <VisualPanel 
        data={createMockData()} 
        updateField={jest.fn()}
      />
    );
    
    await userEvent.click(screen.getByText('Customise'));
    
    const colorPickers = document.querySelectorAll('.color-picker-circle');
    fireEvent.change(colorPickers[0], { target: { value: '#FF0000' } });
    
    expect(screen.getByText('Hide Customisation')).toBeInTheDocument();
  });

  test('updates cloud background color with callback', async () => {
    const mockUpdateCloudColors = jest.fn();
    
    render(
      <VisualPanel 
        data={createMockData()} 
        updateField={jest.fn()}
        updateCloudColors={mockUpdateCloudColors}
      />
    );
    
    await userEvent.click(screen.getByText('Customise'));
    
    const cloudColorPickers = document.querySelectorAll('.cloud-color-picker');
    fireEvent.change(cloudColorPickers[0], { target: { value: '#00ff00' } });
    
    expect(mockUpdateCloudColors).toHaveBeenCalled();
  });

  test('updates cloud text color with callback', async () => {
    const mockUpdateCloudColors = jest.fn();
    
    render(
      <VisualPanel 
        data={createMockData()} 
        updateField={jest.fn()}
        updateCloudColors={mockUpdateCloudColors}
      />
    );
    
    await userEvent.click(screen.getByText('Customise'));
    
    const cloudColorPickers = document.querySelectorAll('.cloud-color-picker');
    fireEvent.change(cloudColorPickers[1], { target: { value: '#ffffff' } });
    
    expect(mockUpdateCloudColors).toHaveBeenCalled();
  });

  test('updates cloud color without callback', async () => {
    render(
      <VisualPanel 
        data={createMockData()} 
        updateField={jest.fn()}
      />
    );
    
    await userEvent.click(screen.getByText('Customise'));
    
    const cloudColorPickers = document.querySelectorAll('.cloud-color-picker');
    fireEvent.change(cloudColorPickers[0], { target: { value: '#00ff00' } });
    
    expect(screen.getByText('Hide Customisation')).toBeInTheDocument();
  });

  test('uses provided columnColors', () => {
    const colors = {
      activities: { bg: '#ff0000', text: '#ffffff' }
    };
    
    render(
      <VisualPanel 
        data={createMockData()} 
        updateField={jest.fn()}
        columnColors={colors}
      />
    );
    
    expect(document.querySelector('.flow-card')).toBeInTheDocument();
  });

  test('uses empty columnColors object', () => {
    render(
      <VisualPanel 
        data={createMockData()} 
        updateField={jest.fn()}
        columnColors={{}}
      />
    );
    
    expect(document.querySelector('.flow-card')).toBeInTheDocument();
  });

  test('uses provided cloudColors', () => {
    const colors = [{ bg: '#ff0000', text: '#ffffff' }];
    
    render(
      <VisualPanel 
        data={createMockData()} 
        updateField={jest.fn()}
        cloudColors={colors}
      />
    );
    
    expect(document.querySelector('.influence-cloud')).toBeInTheDocument();
  });

  test('uses empty cloudColors array', () => {
    render(
      <VisualPanel 
        data={createMockData()} 
        updateField={jest.fn()}
        cloudColors={[]}
      />
    );
    
    expect(document.querySelector('.influence-cloud')).toBeInTheDocument();
  });
});

describe('VisualPanel - Export', () => {
  test('exports diagram successfully', async () => {
    const { exportVisualDiagram } = require('../utils/exportUtils');
    exportVisualDiagram.mockResolvedValue(undefined);
    
    render(<VisualPanel data={createMockData()} updateField={jest.fn()} />);
    
    await userEvent.click(screen.getByText('Export'));
    
    await waitFor(() => {
      expect(exportVisualDiagram).toHaveBeenCalled();
      expect(screen.getByText(/Diagram exported successfully/i)).toBeInTheDocument();
    });
  });

  test('handles export error', async () => {
    const { exportVisualDiagram } = require('../utils/exportUtils');
    exportVisualDiagram.mockRejectedValue(new Error('Export failed'));
    
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<VisualPanel data={createMockData()} updateField={jest.fn()} />);
    
    await userEvent.click(screen.getByText('Export'));
    
    await waitFor(() => {
      expect(screen.getByText(/Export failed/i)).toBeInTheDocument();
    });
    
    consoleSpy.mockRestore();
  });
});

describe('VisualPanel - Edge Cases', () => {
  test('handles empty data', () => {
    const emptyData: Data = {
      projectTitle: '',
      activities: '',
      objectives: '',
      aim: '',
      goal: '',
      beneficiaries: '',
      externalInfluences: ''
    };
    
    const { container } = render(<VisualPanel data={emptyData} updateField={jest.fn()} />);
    expect(container).toBeInTheDocument();
  });

  test('handles invalid JSON', () => {
    const invalidData: Data = {
      ...createMockData(),
      activities: 'not valid json'
    };
    
    const { container } = render(<VisualPanel data={invalidData} updateField={jest.fn()} />);
    expect(container).toBeInTheDocument();
  });

  test('handles malformed JSON in activities', () => {
    const badData = {
      ...createMockData(),
      activities: 'not[valid{json'
    };
    
    const { container } = render(<VisualPanel data={badData} updateField={jest.fn()} />);
    expect(container).toBeInTheDocument();
  });

  
  
  test('handles empty arrays in fields', () => {
    const emptyArrayData = {
      ...createMockData(),
      activities: '[]',
      objectives: '[]'
    };
    
    const { container } = render(<VisualPanel data={emptyArrayData} updateField={jest.fn()} />);
    
    expect(container).toBeInTheDocument();
    expect(screen.getByText('Aim')).toBeInTheDocument();
    expect(screen.getByText('Goal')).toBeInTheDocument();
  });

  test('handles non-array JSON value', () => {
    const data = {
      ...createMockData(),
      activities: '"single string"'
    };
    
    render(<VisualPanel data={data} updateField={jest.fn()} />);
    expect(document.querySelector('.flow-card')).toBeInTheDocument();
  });

  test('handles null field values', () => {
    const data = {
      projectTitle: 'Test',
      activities: null as any,
      objectives: null as any,
      aim: null as any,
      goal: null as any,
      beneficiaries: '',
      externalInfluences: null as any
    };
    
    const { container } = render(<VisualPanel data={data} updateField={jest.fn()} />);
    expect(container).toBeInTheDocument();
  });

  test('updates local columnColors when prop changes', () => {
    const initialColors = { activities: { bg: '#111111', text: '#ffffff' } };
    
    const { rerender } = render(
      <VisualPanel 
        data={createMockData()} 
        updateField={jest.fn()}
        columnColors={initialColors}
      />
    );
    
    const updatedColors = { activities: { bg: '#222222', text: '#000000' } };
    
    rerender(
      <VisualPanel 
        data={createMockData()} 
        updateField={jest.fn()}
        columnColors={updatedColors}
      />
    );
    
    expect(document.querySelector('.flow-card')).toBeInTheDocument();
  });

  test('updates local cloudColors when prop changes', () => {
    const initialColors = [{ bg: '#111111', text: '#ffffff' }];
    
    const { rerender } = render(
      <VisualPanel 
        data={createMockData()} 
        updateField={jest.fn()}
        cloudColors={initialColors}
      />
    );
    
    const updatedColors = [{ bg: '#222222', text: '#000000' }];
    
    rerender(
      <VisualPanel 
        data={createMockData()} 
        updateField={jest.fn()}
        cloudColors={updatedColors}
      />
    );
    
    expect(document.querySelector('.influence-cloud')).toBeInTheDocument();
  });

  test('handles externalInfluences becoming empty', () => {
    const { rerender } = render(
      <VisualPanel data={createMockData()} updateField={jest.fn()} />
    );
    
    const emptyData = { ...createMockData(), externalInfluences: '' };
    
    rerender(<VisualPanel data={emptyData} updateField={jest.fn()} />);
    
    expect(document.querySelector('.influence-cloud')).toBeInTheDocument();
  });

  

  test('synchronizes cloud colors when count changes', () => {
    const mockUpdateCloudColors = jest.fn();
    
    const { rerender } = render(
      <VisualPanel 
        data={createMockData()} 
        updateField={jest.fn()}
        updateCloudColors={mockUpdateCloudColors}
      />
    );
    
    const moreData = {
      ...createMockData(),
      externalInfluences: '["Cloud 1", "Cloud 2", "Cloud 3"]'
    };
    
    rerender(
      <VisualPanel 
        data={moreData} 
        updateField={jest.fn()}
        updateCloudColors={mockUpdateCloudColors}
      />
    );
    
    expect(mockUpdateCloudColors).toHaveBeenCalled();
  });

  test('uses local colors when cloud count changes without callback', () => {
    const { rerender } = render(
      <VisualPanel data={createMockData()} updateField={jest.fn()} />
    );
    
    const moreData = {
      ...createMockData(),
      externalInfluences: '["Cloud 1", "Cloud 2", "Cloud 3"]'
    };
    
    rerender(<VisualPanel data={moreData} updateField={jest.fn()} />);
    
    const clouds = document.querySelectorAll('.influence-cloud');
    expect(clouds.length).toBe(3);
  });

  test('toast auto-closes after 3 seconds', async () => {
    render(<VisualPanel data={createMockData()} updateField={jest.fn()} />);
    
    await userEvent.click(screen.getByText('Customise'));
    
    const addButtons = screen.getAllByRole('button', { name: '+' });
    const cardAddButtons = addButtons.filter(btn => 
      btn.classList.contains('add-card-btn')
    );
    
    await userEvent.click(cardAddButtons[0]);
    
    expect(screen.getByText(/New Activities field added/i)).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.queryByText(/New Activities field added/i)).not.toBeInTheDocument();
    }, { timeout: 4000 });
  });
});