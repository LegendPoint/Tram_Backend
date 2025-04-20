import React, { useEffect, useState } from 'react';
import { getDatabase, ref, onValue, remove } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { useUserAuth } from '../context/UserAuthContext'; // Add this import
import './Feedback.css';

const Feedback = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const navigate = useNavigate();
  const { user } = useUserAuth(); // Add this line

  useEffect(() => {
    const db = getDatabase();
    const feedbackRef = ref(db, 'feedback');
    onValue(feedbackRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const feedbackList = Object.entries(data).map(([id, feedback]) => ({
          id,
          ...feedback,
        }));
        setFeedbacks(feedbackList);
      } else {
        setFeedbacks([]);
      }
    });
  }, []);

  // Add authentication check at start
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
    const db = getDatabase();
    const feedbackRef = ref(db, `feedback/${id}`);
    await remove(feedbackRef);
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to delete all feedback?')) {
      const db = getDatabase();
      const feedbackRef = ref(db, 'feedback');
      await remove(feedbackRef);
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
        <button className="back-btn" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
      </div>

      {feedbacks.length > 0 && (
        <button className="clear-all-btn" onClick={handleClearAll}>
          Clear All Feedback
        </button>
      )}

      <div className="feedback-list">
        {feedbacks.length === 0 ? (
          <p>No feedback yet.</p>
        ) : (
          feedbacks.map((fb) => (
            <div key={fb.id} className="feedback-row">
              <div className="feedback-card">
                <h3>{fb.email || 'Anonymous'}</h3>
                <span className="timestamp">{formatDate(fb.timestamp)}</span>
                <p className="feedback-message">{fb.message}</p>
              </div>
              <button
                className="delete-btn"
                onClick={() =>
                  window.confirm('Delete this feedback?') && handleDelete(fb.id)
                }
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Feedback;
