import { getDatabase, ref, set, get, remove } from 'firebase/database';

class RouteEditorService {
  constructor() {
    this.db = getDatabase();
  }

  // Get route by color
  async getRouteByColor(color) {
    try {
      const routeRef = ref(this.db, `adminRoutes/${color}`);
      const snapshot = await get(routeRef);
      return snapshot.exists() ? snapshot.val() : [];
    } catch (error) {
      console.error('Error getting route:', error);
      throw error;
    }
  }

  // Save route
  async saveRoute(color, path) {
    try {
      const routeRef = ref(this.db, `adminRoutes/${color}`);
      await set(routeRef, path);
    } catch (error) {
      console.error('Error saving route:', error);
      throw error;
    }
  }

  // Delete route
  async deleteRoute(color) {
    try {
      const routeRef = ref(this.db, `adminRoutes/${color}`);
      await remove(routeRef);
    } catch (error) {
      console.error('Error deleting route:', error);
      throw error;
    }
  }
}

export default new RouteEditorService(); 