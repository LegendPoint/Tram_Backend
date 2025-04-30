import { getDatabase, ref, push, set, onValue, remove } from 'firebase/database';

class EventService {
  constructor() {
    this.db = getDatabase();
  }

  // Create a new event
  async createEvent(eventData, userId) {
    const eventsRef = ref(this.db, 'events');
    const newEventRef = push(eventsRef);
    const eventWithUser = {
      ...eventData,
      createdBy: userId,
      createdAt: new Date().toISOString()
    };
    await set(newEventRef, eventWithUser);
    return newEventRef.key;
  }

  // Get all events with real-time updates
  getAllEvents(callback) {
    const eventsRef = ref(this.db, 'events');
    return onValue(eventsRef, (snapshot) => {
      if (snapshot.exists()) {
        const eventsData = Object.entries(snapshot.val()).map(([id, event]) => ({
          id,
          ...event
        }));
        callback(eventsData);
      } else {
        callback([]);
      }
    });
  }

  // Delete an event
  async deleteEvent(eventId) {
    const eventRef = ref(this.db, `events/${eventId}`);
    await remove(eventRef);
  }

  validateEventData(eventData) {
    const requiredFields = ['name', 'description', 'startDate', 'endDate', 'location'];
    const missingFields = requiredFields.filter(field => !eventData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    if (new Date(eventData.startDate) > new Date(eventData.endDate)) {
      throw new Error('End date must be after start date');
    }
  }
}

export default new EventService(); 