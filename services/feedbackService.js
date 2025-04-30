import { getDatabase, ref, onValue, remove } from 'firebase/database';

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
          ...feedback
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
}

export default new FeedbackService(); 