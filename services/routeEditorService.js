import { getDatabase, ref, set, get, remove } from 'firebase/database';

class RouteEditorService {
  constructor() {
    this.db = getDatabase();
  }

  // Get route by color
  async getRouteByColor(color) {
    try {
      console.log('Service: Getting route for color:', color);
      const routeRef = ref(this.db, `adminRoutes/${color}`);
      const snapshot = await get(routeRef);
      console.log('Service: Firebase snapshot:', snapshot.val());
      return snapshot.exists() ? snapshot.val() : [];
    } catch (error) {
      console.error('Error getting route:', error);
      throw error;
    }
  }

  // Save route
  async saveRoute(color, path) {
    try {
      console.log('Service: Saving route for color:', color, 'path:', path);
      const routeRef = ref(this.db, `adminRoutes/${color}`);
      await set(routeRef, path);
      console.log('Service: Route saved successfully');
    } catch (error) {
      console.error('Error saving route:', error);
      throw error;
    }
  }

  // Delete route
  async deleteRoute(color) {
    try {
      console.log('Service: Deleting route for color:', color);
      const routeRef = ref(this.db, `adminRoutes/${color}`);
      await remove(routeRef);
      console.log('Service: Route deleted successfully');
    } catch (error) {
      console.error('Error deleting route:', error);
      throw error;
    }
  }
}

export default new RouteEditorService(); 