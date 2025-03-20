import { auth } from '../config/firebase.js';

const API_BASE_URL = 'http://localhost:5000/api';

export const getAuthHeaders = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No user logged in');
  }
  const token = await user.getIdToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

export const api = {
  // Get user profile
  getProfile: async () => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/users/profile`, {
      headers
    });
    if (!response.ok) {
      throw new Error('Failed to fetch profile');
    }
    return response.json();
  },

  // Check if user is admin
  checkAdminAccess: async () => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/users/admin`, {
      headers
    });
    if (!response.ok) {
      throw new Error('Admin access denied');
    }
    return response.json();
  }
}; 