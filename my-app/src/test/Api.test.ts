import axios from 'axios';
import {
  fetchUserProfile,
  updateUserProfile,
  createTocProject,
  updateToc,
  fetchUserTocs,
  fetchTocProjectById
} from '../services/api';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('User Profile API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  describe('fetchUserProfile', () => {
    test('successfully fetches user profile', async () => {
      const mockUserData = {
        userId: 1,
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        organisation: 'Test Org',
        avatarUrl: 'https://example.com/avatar.jpg',
        displayName: 'Test User',
        createdAt: '2024-01-01T00:00:00Z'
      };

      mockedAxios.get.mockResolvedValue({
        data: {
          success: true,
          data: mockUserData,
          message: 'Profile fetched successfully'
        }
      });

      const result = await fetchUserProfile();

      expect(result).toEqual(mockUserData);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/user/Get'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    test('throws error when API returns success: false', async () => {
  mockedAxios.get.mockResolvedValue({
    data: {
      success: false,
      message: 'User not found'
    }
  });

  await expect(fetchUserProfile()).rejects.toThrow(); 
});

    test('throws error when API returns success: false without message', async () => {
  mockedAxios.get.mockResolvedValue({
    data: {
      success: false
    }
  });

  await expect(fetchUserProfile()).rejects.toThrow(); 
});

    test('falls back to localStorage on network error', async () => {
      const mockLocalUser = {
        userId: '2',
        email: 'local@example.com',
        username: 'localuser',
        firstName: 'Local',
        lastName: 'User',
        organisation: 'Local Org'
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockLocalUser));
      
      mockedAxios.get.mockRejectedValue({
        isAxiosError: true,
        code: 'ERR_NETWORK',
        message: 'Network Error'
      });

      const result = await fetchUserProfile();

      expect(result).toEqual({
        userId: 2,
        email: 'local@example.com',
        username: 'localuser',
        firstName: 'Local',
        lastName: 'User',
        organisation: 'Local Org',
        avatarUrl: null,
        displayName: 'Local User',
        createdAt: expect.any(String)
      });
    });

    test('falls back to localStorage with org field', async () => {
      const mockLocalUser = {
        userId: '3',
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        org: 'Test Organization'
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockLocalUser));
      
      mockedAxios.get.mockRejectedValue({
        isAxiosError: true,
        code: 'ERR_NETWORK'
      });

      const result = await fetchUserProfile();

      expect(result.organisation).toBe('Test Organization');
    });

    test('uses default values when localStorage user has missing fields', async () => {
      const mockLocalUser = {};

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockLocalUser));
      
      mockedAxios.get.mockRejectedValue({
        isAxiosError: true,
        code: 'ERR_NETWORK'
      });

      const result = await fetchUserProfile();

      expect(result).toEqual({
        userId: 0,
        email: 'demo@example.com',
        username: 'demo',
        firstName: 'Demo',
        lastName: 'User',
        organisation: '',
        avatarUrl: null,
        displayName: 'Demo User',
        createdAt: expect.any(String)
      });
    });

    test('throws error when no localStorage user available on network error', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      mockedAxios.get.mockRejectedValue({
        isAxiosError: true,
        code: 'ERR_NETWORK'
      });

      await expect(fetchUserProfile()).rejects.toThrow('No local user available');
    });

    test('throws error when localStorage contains invalid JSON', async () => {
      localStorageMock.getItem.mockReturnValue('invalid json{');
      
      mockedAxios.get.mockRejectedValue({
        isAxiosError: true,
        code: 'ERR_NETWORK'
      });

      await expect(fetchUserProfile()).rejects.toThrow();
    });

    test('throws error for non-network errors', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      mockedAxios.get.mockRejectedValue({
        response: {
          data: {
            message: 'Unauthorized'
          }
        }
      });

      await expect(fetchUserProfile()).rejects.toThrow('Unauthorized');
    });

   test('throws error for non-network errors without response message', async () => {
  mockedAxios.get.mockRejectedValue(new Error('Something went wrong'));

  await expect(fetchUserProfile()).rejects.toThrow(); 
});

   test('throws generic error when no message available', async () => {
  mockedAxios.get.mockRejectedValue({});

  await expect(fetchUserProfile()).rejects.toThrow(); 
});
  });

  describe('updateUserProfile', () => {
    test('successfully updates user profile', async () => {
      const updatePayload = {
        firstName: 'Updated',
        lastName: 'Name',
        organisation: 'New Org',
        username: 'newusername'
      };

      const mockUpdatedData = {
        userId: 1,
        ...updatePayload
      };

      mockedAxios.put.mockResolvedValue({
        data: {
          success: true,
          data: mockUpdatedData,
          message: 'Profile updated successfully'
        }
      });

      const result = await updateUserProfile(updatePayload);

      expect(result).toEqual(mockUpdatedData);
      expect(mockedAxios.put).toHaveBeenCalledWith(
        expect.stringContaining('/api/user/Update'),
        updatePayload,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    test('updates with partial payload', async () => {
      const updatePayload = {
        firstName: 'John'
      };

      mockedAxios.put.mockResolvedValue({
        data: {
          success: true,
          data: { firstName: 'John' },
          message: 'Profile updated'
        }
      });

      const result = await updateUserProfile(updatePayload);

      expect(result).toEqual({ firstName: 'John' });
    });

    test('throws error when API returns success: false', async () => {
      mockedAxios.put.mockResolvedValue({
        data: {
          success: false,
          message: 'Update failed'
        }
      });

      await expect(updateUserProfile({ firstName: 'Test' })).rejects.toThrow('Update failed');
    });

    test('throws error when API returns success: false without message', async () => {
      mockedAxios.put.mockResolvedValue({
        data: {
          success: false
        }
      });

      await expect(updateUserProfile({ firstName: 'Test' })).rejects.toThrow('Failed to update user profile');
    });

    test('throws error on request failure with response message', async () => {
      mockedAxios.put.mockRejectedValue({
        response: {
          data: {
            message: 'Invalid data'
          }
        }
      });

      await expect(updateUserProfile({ firstName: 'Test' })).rejects.toThrow('Invalid data');
    });

    test('throws error on request failure with error message', async () => {
      mockedAxios.put.mockRejectedValue(new Error('Network error'));

      await expect(updateUserProfile({ firstName: 'Test' })).rejects.toThrow('Network error');
    });

    test('throws generic error when no message available', async () => {
      mockedAxios.put.mockRejectedValue({});

      await expect(updateUserProfile({ firstName: 'Test' })).rejects.toThrow('Failed to update user profile');
    });
  });
});

describe('TOC Project APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  describe('createTocProject', () => {
    test('successfully creates a project', async () => {
      const projectData = {
        userId: '123',
        projectTitle: 'New Project',
        status: 'draft' as const
      };

      const mockResponse = {
        success: true,
        message: 'Project created',
        statusCode: 200,
        data: {
          projectId: 'proj-123',
          tocData: { projectTitle: 'New Project' },
          tocColor: {}
        }
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      const result = await createTocProject(projectData);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/project/Create'),
        projectData,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    test('creates project with published status', async () => {
      const projectData = {
        userId: '123',
        projectTitle: 'Published Project',
        status: 'published' as const
      };

      mockedAxios.post.mockResolvedValue({
        data: {
          success: true,
          data: { projectId: 'proj-456' }
        }
      });

      const result = await createTocProject(projectData);

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ status: 'published' }),
        expect.any(Object)
      );
    });

    test('creates project locally on network error', async () => {
      const projectData = {
        userId: '123',
        projectTitle: 'Offline Project',
        status: 'draft' as const
      };

      mockedAxios.post.mockRejectedValue({
        isAxiosError: true,
        code: 'ERR_NETWORK'
      });

      const result = await createTocProject(projectData);

      expect(result.success).toBe(true);
      expect(result.message).toContain('offline mode');
      expect(result.data.projectId).toMatch(/^local-\d+$/);
      expect(result.data.tocData.projectTitle).toBe('Offline Project');
    });

    test('throws error on non-network failures with response message', async () => {
      mockedAxios.post.mockRejectedValue({
        response: {
          data: {
            message: 'Validation error'
          }
        }
      });

      await expect(createTocProject({
        userId: '123',
        projectTitle: 'Test',
        status: 'draft'
      })).rejects.toThrow('Validation error');
    });

    test('creates project locally on non-network failures with error message', async () => {
      // This should fall back to offline mode, not throw
      mockedAxios.post.mockRejectedValue(new Error('Server error'));

      const result = await createTocProject({
        userId: '123',
        projectTitle: 'Test',
        status: 'draft'
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('offline mode');
    });

    test('creates project locally when no message available', async () => {
      // This should fall back to offline mode, not throw
      mockedAxios.post.mockRejectedValue({});

      const result = await createTocProject({
        userId: '123',
        projectTitle: 'Test',
        status: 'draft'
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('offline mode');
    });
  });

  describe('updateToc', () => {
    test('successfully updates TOC project', async () => {
      localStorageMock.getItem.mockReturnValue('valid-token-123');

      const updatePayload = {
        projectId: 'proj-123',
        tocData: { projectTitle: 'Updated Project' },
        tocColor: { activities: '#ff0000' }
      };

      const mockResponse = {
        success: true,
        message: 'Project updated',
        data: updatePayload,
        statusCode: 200
      };

      mockedAxios.put.mockResolvedValue({ data: mockResponse });

      const result = await updateToc(updatePayload);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios.put).toHaveBeenCalledWith(
        expect.stringContaining('/api/project/Update'),
        updatePayload,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-token-123'
          })
        })
      );
    });

    test('throws error when no token is available', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      await expect(updateToc({ projectId: '123' })).rejects.toThrow('No authentication token found');
    });

    test('saves locally on network error', async () => {
      localStorageMock.getItem.mockReturnValue('valid-token');

      mockedAxios.put.mockRejectedValue({
        isAxiosError: true,
        code: 'ERR_NETWORK'
      });

      const result = await updateToc({ projectId: '123' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('offline mode');
    });

    test('throws error on non-network failures with response message', async () => {
      localStorageMock.getItem.mockReturnValue('valid-token');

      mockedAxios.put.mockRejectedValue({
        response: {
          data: {
            message: 'Project not found'
          }
        }
      });

      await expect(updateToc({ projectId: '123' })).rejects.toThrow('Project not found');
    });

    test('saves locally on non-network failures with error message', async () => {
      // This should fall back to offline mode, not throw
      localStorageMock.getItem.mockReturnValue('valid-token');

      mockedAxios.put.mockRejectedValue(new Error('Update failed'));

      const result = await updateToc({ projectId: '123' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('offline mode');
    });

    test('saves locally when no message available', async () => {
      // This should fall back to offline mode, not throw
      localStorageMock.getItem.mockReturnValue('valid-token');

      mockedAxios.put.mockRejectedValue({});

      const result = await updateToc({ projectId: '123' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('offline mode');
    });
  });

  describe('fetchUserTocs', () => {
    test('successfully fetches user projects', async () => {
      const mockProjects = {
        success: true,
        data: {
          projects: [
            { projectId: '1', projectTitle: 'Project 1' },
            { projectId: '2', projectTitle: 'Project 2' }
          ]
        },
        message: 'Projects fetched'
      };

      mockedAxios.get.mockResolvedValue({ data: mockProjects });

      const result = await fetchUserTocs();

      expect(result).toEqual(mockProjects);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/project/GetProjectList'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    test('returns empty list on network error', async () => {
      mockedAxios.get.mockRejectedValue({
        isAxiosError: true,
        code: 'ERR_NETWORK'
      });

      const result = await fetchUserTocs();

      expect(result.success).toBe(true);
      expect(result.data.projects).toEqual([]);
      expect(result.message).toContain('offline mode');
    });

    test('throws error on non-network failures with response message', async () => {
      mockedAxios.get.mockRejectedValue({
        response: {
          data: {
            message: 'Unauthorized access'
          }
        }
      });

      await expect(fetchUserTocs()).rejects.toThrow('Unauthorized access');
    });

    test('returns empty list on non-network failures with error message', async () => {
      // This should fall back to offline mode, not throw
      mockedAxios.get.mockRejectedValue(new Error('Fetch failed'));

      const result = await fetchUserTocs();

      expect(result.success).toBe(true);
      expect(result.data.projects).toEqual([]);
      expect(result.message).toContain('offline mode');
    });

    test('returns empty list when no message available', async () => {
      // This should fall back to offline mode, not throw
      mockedAxios.get.mockRejectedValue({});

      const result = await fetchUserTocs();

      expect(result.success).toBe(true);
      expect(result.data.projects).toEqual([]);
      expect(result.message).toContain('offline mode');
    });
  });

  describe('fetchTocProjectById', () => {
    test('successfully fetches project by ID', async () => {
      const mockProject = {
        success: true,
        data: {
          projectId: 'proj-123',
          tocData: { projectTitle: 'My Project' },
          tocColor: { activities: '#ff0000' }
        },
        message: 'Project fetched'
      };

      mockedAxios.get.mockResolvedValue({ data: mockProject });

      const result = await fetchTocProjectById('proj-123');

      expect(result).toEqual(mockProject);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/project/Get'),
        expect.objectContaining({
          params: { projectId: 'proj-123' },
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    test('throws error when projectId is empty string', async () => {
      await expect(fetchTocProjectById('')).rejects.toThrow('Project ID is required');
    });

    test('throws error when projectId is not provided', async () => {
      await expect(fetchTocProjectById(null as any)).rejects.toThrow('Project ID is required');
    });

    test('returns empty project on network error', async () => {
      mockedAxios.get.mockRejectedValue({
        isAxiosError: true,
        code: 'ERR_NETWORK'
      });

      const result = await fetchTocProjectById('proj-123');

      expect(result.success).toBe(true);
      expect(result.data.projects).toEqual([]);
      expect(result.message).toContain('offline mode');
    });

    test('throws error on non-network failures with response message', async () => {
      mockedAxios.get.mockRejectedValue({
        response: {
          data: {
            message: 'Project not found'
          }
        }
      });

      await expect(fetchTocProjectById('proj-123')).rejects.toThrow('Project not found');
    });

    test('returns empty project on non-network failures with error message', async () => {
      // This should fall back to offline mode, not throw
      mockedAxios.get.mockRejectedValue(new Error('Fetch error'));

      const result = await fetchTocProjectById('proj-123');

      expect(result.success).toBe(true);
      expect(result.data.projects).toEqual([]);
      expect(result.message).toContain('offline mode');
    });

    test('returns empty project when no message available', async () => {
      // This should fall back to offline mode, not throw
      mockedAxios.get.mockRejectedValue({});

      const result = await fetchTocProjectById('proj-123');

      expect(result.success).toBe(true);
      expect(result.data.projects).toEqual([]);
      expect(result.message).toContain('offline mode');
    });
  });
});