import { getDatabase, ref, set, get } from 'firebase/database';

class RouteService {
  constructor() {
    this.db = getDatabase();
  }

  // Get route by color
  async getRouteByColor(color) {
    const routeRef = ref(this.db, `adminRoutes/${color}`);
    const snapshot = await get(routeRef);
    return snapshot.exists() ? snapshot.val() : [];
  }

  // Save route
  async saveRoute(color, path) {
    const routeRef = ref(this.db, `adminRoutes/${color}`);
    await set(routeRef, path);
  }

  // Get all routes
  async getAllRoutes() {
    const routesRef = ref(this.db, 'Routes');
    const adminRoutesRef = ref(this.db, 'adminRoutes');
    const [routesSnapshot, adminRoutesSnapshot] = await Promise.all([
      get(routesRef),
      get(adminRoutesRef)
    ]);
    
    return {
      routes: routesSnapshot.exists() ? routesSnapshot.val() : {},
      adminRoutes: adminRoutesSnapshot.exists() ? adminRoutesSnapshot.val() : {}
    };
  }
}

export default new RouteService(); 