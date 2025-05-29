class Event {
  constructor(data) {
    this.name = data.name;
    this.description = data.description;
    this.location = data.location;
    this.startDate = data.startDate;
    this.endDate = data.endDate;
    this.status = data.status || 'active';
    this.createdBy = data.createdBy;
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      description: this.description,
      location: this.location,
      startDate: this.startDate,
      endDate: this.endDate,
      status: this.status,
      createdBy: this.createdBy,
      createdAt: this.createdAt
    };
  }

  static validate(data) {
    if (!data.name || typeof data.name !== 'string') {
      throw new Error('Event name is required and must be a string');
    }

    if (!data.description || typeof data.description !== 'string') {
      throw new Error('Event description is required and must be a string');
    }

    if (!data.location || typeof data.location !== 'object') {
      throw new Error('Event location is required and must be an object');
    }

    if (!data.startDate || !data.endDate) {
      throw new Error('Event start and end dates are required');
    }

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date format');
    }

    if (startDate > endDate) {
      throw new Error('End date must be after start date');
    }
  }
}

export default Event; 