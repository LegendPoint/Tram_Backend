import { getDatabase, ref, push, set } from 'firebase/database';

class EventService {
  constructor() {
    this.db = getDatabase();
  }

  async createEvent(eventData, userId) {
    try {
      if (!userId) {
        throw new Error('You must be logged in to add events');
      }

      if (!eventData.location) {
        throw new Error('Please select a location on the map');
      }

      const eventsRef = ref(this.db, 'events');
      const newEventRef = push(eventsRef);
      
      const eventWithMetadata = {
        ...eventData,
        createdBy: userId,
        createdAt: new Date().toISOString()
      };

      await set(newEventRef, eventWithMetadata);
      return { success: true, eventId: newEventRef.key };
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
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