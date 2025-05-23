import { getDatabase, ref, push, set, onValue, remove, update, get } from 'firebase/database';
import { getStorage, ref as storageRef, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage';

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

  // Update an event (for imageUrl/imageName)
  async updateEvent(eventId, updateData) {
    const eventRef = ref(this.db, `events/${eventId}`);
    await update(eventRef, updateData);
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

  // Delete an event and its image
  async deleteEvent(eventId) {
    const eventRef = ref(this.db, `events/${eventId}`);
    // Get event data to find imageName
    const snapshot = await get(eventRef);
    if (snapshot.exists()) {
      const eventData = snapshot.val();
      if (eventData.imageName) {
        const storage = getStorage();
        const imgRef = storageRef(storage, `Events/${eventId}/${eventData.imageName}`);
        try {
          await deleteObject(imgRef);
        } catch (error) {
          console.error('Error deleting event image:', error);
        }
      }
    }
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

  // Update event with image replacement
  async updateEventWithImage(eventId, updateData, newImageFile) {
    const eventRef = ref(this.db, `events/${eventId}`);
    let imageUrl = updateData.imageUrl || null;
    let imageName = updateData.imageName || null;
    // Get current event data to check for old image
    const snapshot = await get(eventRef);
    if (snapshot.exists()) {
      const eventData = snapshot.val();
      // If a new image is provided, delete the old one and upload the new one
      if (newImageFile) {
        if (eventData.imageName) {
          const storage = getStorage();
          const oldImgRef = storageRef(storage, `Events/${eventId}/${eventData.imageName}`);
          try {
            await deleteObject(oldImgRef);
          } catch (error) {
            console.error('Error deleting old event image:', error);
          }
        }
        // Upload new image
        const storage = getStorage();
        const newImgRef = storageRef(storage, `Events/${eventId}/${newImageFile.name}`);
        await uploadBytes(newImgRef, newImageFile);
        imageUrl = await getDownloadURL(newImgRef);
        imageName = newImageFile.name;
      }
      // Update event with new data
      await update(eventRef, { ...updateData, imageUrl, imageName });
    }
  }
}

export default new EventService(); 