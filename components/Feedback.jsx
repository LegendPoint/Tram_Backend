import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserAuth } from '../context/UserAuthContext';
import feedbackService from '../services/feedbackService';
import './Feedback.css';

const Feedback = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const navigate = useNavigate();
  const { user } = useUserAuth();

  // Separate feedbacks into active and archived
  const activeFeedbacks = feedbacks.filter(fb => !fb.isArchived);
  const archivedFeedbacks = feedbacks.filter(fb => fb.isArchived);

  useEffect(() => {
    const unsubscribe = feedbackService.getAllFeedback((feedbackData) => {
      setFeedbacks(feedbackData);
    });

    return () => unsubscribe();
  }, []);

  if (!user) {
    return (
      <div className="feedback-page">
        <p>Please log in to access feedback management.</p>
        <button className="back-btn" onClick={() => navigate('/')}>
          Go to Home
        </button>
      </div>
    );
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this feedback?')) {
      try {
        await feedbackService.deleteFeedback(id);
      } catch (error) {
        console.error('Error deleting feedback:', error);
        alert('Failed to delete feedback. Please try again.');
      }
    }
  };

  const handleArchive = async (id) => {
    try {
      await feedbackService.archiveFeedback(id);
    } catch (error) {
      console.error('Error archiving feedback:', error);
      alert('Failed to archive feedback. Please try again.');
    }
  };

  const handleUnarchive = async (id) => {
    try {
      await feedbackService.unarchiveFeedback(id);
    } catch (error) {
      console.error('Error unarchiving feedback:', error);
      alert('Failed to unarchive feedback. Please try again.');
    }
  };

  const handleClearActive = async () => {
    if (window.confirm('Are you sure you want to delete all active feedbacks? This action cannot be undone.')) {
      try {
        const deletePromises = activeFeedbacks.map(fb => feedbackService.deleteFeedback(fb.id));
        await Promise.all(deletePromises);
      } catch (error) {
        console.error('Error clearing active feedbacks:', error);
        alert('Failed to clear active feedbacks. Please try again.');
      }
    }
  };

  const handleClearArchived = async () => {
    if (window.confirm('Are you sure you want to delete all archived feedbacks? This action cannot be undone.')) {
      try {
        const deletePromises = archivedFeedbacks.map(fb => feedbackService.deleteFeedback(fb.id));
        await Promise.all(deletePromises);
      } catch (error) {
        console.error('Error clearing archived feedbacks:', error);
        alert('Failed to clear archived feedbacks. Please try again.');
      }
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="feedback-page">
      <div className="feedback-header-bar">
        <h1>User Feedback</h1>
        <div className="header-actions">
          <button 
            className="clear-active-btn" 
            onClick={handleClearActive}
            disabled={activeFeedbacks.length === 0}
          >
            Clear Active Feedbacks
          </button>
          <button 
            className="clear-archived-btn" 
            onClick={handleClearArchived}
            disabled={archivedFeedbacks.length === 0}
          >
            Clear Archived Feedbacks
          </button>
        <button className="back-btn" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
        </div>
      </div>

      {/* Active Feedbacks Section */}
      <div className="feedback-section">
        <h2>Active Feedbacks</h2>
      <div className="feedback-list">
          {activeFeedbacks.length === 0 ? (
            <p className="no-feedback">No active feedbacks.</p>
        ) : (
            activeFeedbacks.map((fb) => (
            <div key={fb.id} className="feedback-row">
              <div className="feedback-card">
                <h3>{fb.email || 'Anonymous'}</h3>
                <span className="timestamp">{formatDate(fb.timestamp)}</span>
                <p className="feedback-message">{fb.message}</p>
              </div>
                <div className="feedback-actions">
                  <button
                    className="archive-btn"
                    onClick={() => handleArchive(fb.id)}
                  >
                    Archive
                  </button>
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(fb.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Archived Feedbacks Section */}
      <div className="feedback-section archive-section">
        <h2>Archived Feedbacks</h2>
        <div className="feedback-list">
          {archivedFeedbacks.length === 0 ? (
            <p className="no-feedback">No archived feedbacks.</p>
          ) : (
            archivedFeedbacks.map((fb) => (
              <div key={fb.id} className="feedback-row">
                <div className="feedback-card archived-card">
                  <h3>{fb.email || 'Anonymous'}</h3>
                  <span className="timestamp">
                    {formatDate(fb.timestamp)}
                    {fb.archivedAt && (
                      <span className="archived-date">
                        (Archived: {formatDate(fb.archivedAt)})
                      </span>
                    )}
                  </span>
                  <p className="feedback-message">{fb.message}</p>
                </div>
                <div className="feedback-actions">
                  <button
                    className="unarchive-btn"
                    onClick={() => handleUnarchive(fb.id)}
                  >
                    Unarchive
                  </button>
              <button
                className="delete-btn"
                    onClick={() => handleDelete(fb.id)}
              >
                Delete
              </button>
                </div>
            </div>
          ))
        )}
        </div>
      </div>
    </div>
  );
};

export default Feedback;
