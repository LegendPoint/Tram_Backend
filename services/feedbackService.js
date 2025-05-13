import { getDatabase, ref, onValue, remove, update } from 'firebase/database';

class FeedbackService {
  constructor() {
    this.db = getDatabase();
  }

  // Get all feedback with real-time updates
  getAllFeedback(callback) {
    const feedbackRef = ref(this.db, 'feedback');
    return onValue(feedbackRef, (snapshot) => {
      if (snapshot.exists()) {
        const feedbackList = Object.entries(snapshot.val()).map(([id, feedback]) => ({
          id,
          ...feedback,
          isArchived: feedback.isArchived || false
        }));
        callback(feedbackList);
      } else {
        callback([]);
      }
    });
  }

  // Delete a single feedback
  async deleteFeedback(feedbackId) {
    const feedbackRef = ref(this.db, `feedback/${feedbackId}`);
    await remove(feedbackRef);
  }

  // Delete all feedback
  async deleteAllFeedback() {
    const feedbackRef = ref(this.db, 'feedback');
    await remove(feedbackRef);
  }

  // Archive a feedback
  async archiveFeedback(feedbackId) {
    const feedbackRef = ref(this.db, `feedback/${feedbackId}`);
    await update(feedbackRef, {
      isArchived: true,
      archivedAt: new Date().toISOString()
    });
  }

  // Unarchive a feedback
  async unarchiveFeedback(feedbackId) {
    const feedbackRef = ref(this.db, `feedback/${feedbackId}`);
    await update(feedbackRef, {
      isArchived: false,
      archivedAt: null
    });
  }
}

export default new FeedbackService(); 