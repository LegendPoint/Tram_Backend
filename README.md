# Tram Simulation Backend

A backend service for the Tram Simulation application, built with Node.js, Express, and Firebase.

## Setup Instructions

1. Clone the repository:
```bash
git clone <your-repository-url>
cd travel-simulation-backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
   - Copy `.env.example` to `.env`
   - Fill in your Firebase and Google Maps API credentials

4. Set up Firebase:
   - Create a Firebase project
   - Download your service account key and save it as `service-account.json` in the root directory
   - Enable Email/Password authentication in Firebase Console

5. Start the development server:
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:5000

## Environment Variables

Create a `.env` file with the following variables:

```env
PORT=5000
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

## Security Notes

- Never commit `.env` or `service-account.json` files
- Keep your API keys and credentials secure
- Use environment variables for sensitive information

## License

ISC 