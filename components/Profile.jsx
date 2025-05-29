import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileData = await api.getProfile();
        setProfile(profileData.user);
        
        // Check admin access
        try {
          await api.checkAdminAccess();
          setIsAdmin(true);
        } catch (err) {
          setIsAdmin(false);
        }
      } catch (err) {
        setError(err.message);
      }
    };

    fetchProfile();
  }, []);

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  if (!profile) {
    return <div className="loading">Loading profile...</div>;
  }

  return (
    <div className="profile-container">
      <h2>User Profile</h2>
      <div className="profile-info">
        <p><strong>Email:</strong> {profile.email}</p>
        <p><strong>Role:</strong> {profile.role}</p>
        {isAdmin && (
          <div className="admin-badge">
            Admin Access Granted
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile; 